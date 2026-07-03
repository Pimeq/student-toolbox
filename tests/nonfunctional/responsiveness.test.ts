import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
	hasPrimaryUser,
	hasSupabaseCreds,
	resolveWritableGroupId,
	signIn,
	type SignedInClient,
} from "./support/env"
import { printReportTable, record } from "./support/report"

const runnable = hasSupabaseCreds && hasPrimaryUser
const ITERATIONS = 5

describe.skipIf(!runnable)("Responsywność (0 błędów)", () => {
	let session: SignedInClient
	let groupId: string | null

	beforeAll(async () => {
		session = await signIn(process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!)
		groupId = await resolveWritableGroupId(session)
	})

	afterAll(() => printReportTable())

	it("seria operacji CRUD/odczytu nie zgłasza błędów", async () => {
		const errors: string[] = []
		const track = (label: string, error: { message: string } | null) => {
			if (error) errors.push(`${label}: ${error.message}`)
		}

		for (let i = 0; i < ITERATIONS; i++) {
			const notes = await session.supabase
				.from("files")
				.select("id, name")
				.eq("uploaded_by", session.userId)
				.eq("file_type", "note")
			track(`READ notatki #${i}`, notes.error)

			const groups = await session.supabase
				.from("user_memberships")
				.select("group_id, role")
				.eq("user_id", session.userId)
			track(`READ grupy #${i}`, groups.error)

			if (!groupId) continue

			const created = await session.supabase
				.from("events")
				.insert({
					title: `NF-TEST responsywność ${i} ${Date.now()}`,
					group_id: groupId,
					uploaded_by: session.userId,
					starts_at: new Date().toISOString(),
					ends_at: new Date(Date.now() + 3_600_000).toISOString(),
				})
				.select("id")
				.single()
			track(`CREATE zdarzenie #${i}`, created.error)

			const eventId = created.data?.id
			if (eventId == null) continue

			const updated = await session.supabase
				.from("events")
				.update({ title: `NF-TEST responsywność ${i} (edytowane)` })
				.eq("id", eventId)
				.select("id")
			track(`UPDATE zdarzenie #${i}`, updated.error)

			const deleted = await session.supabase.from("events").delete().eq("id", eventId).select("id")
			track(`DELETE zdarzenie #${i}`, deleted.error)
		}

		record("Responsywność", `${errors.length} błędów`)
		expect(errors, `Wystąpiły błędy:\n${errors.join("\n")}`).toHaveLength(0)
	})
})
