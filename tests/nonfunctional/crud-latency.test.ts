import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import {
	BUDGETS,
	hasPrimaryUser,
	hasSupabaseCreds,
	resolveWritableGroupId,
	signIn,
	type SignedInClient,
} from "./support/env"
import { measure, printReportTable, record } from "./support/report"

const runnable = hasSupabaseCreds && hasPrimaryUser

describe.skipIf(!runnable)("Latencja CRUD (norma < 300 ms)", () => {
	let session: SignedInClient
	let groupId: string | null
	const createdEventIds: number[] = []

	beforeAll(async () => {
		session = await signIn(process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!)
		groupId = await resolveWritableGroupId(session)
	})

	afterEach(async () => {
		if (createdEventIds.length) {
			await session.supabase.from("events").delete().in("id", createdEventIds.splice(0))
		}
	})

	afterAll(() => printReportTable())

	it("Latencja CRUD (CREATE zdarzenie) < 300 ms", async () => {
		expect(groupId, "Brak grupy do zapisu zdarzenia — ustaw TEST_GROUP_ID").toBeTruthy()

		const now = new Date()
		const end = new Date(now.getTime() + 3_600_000)

		const { value, ms } = await measure(() =>
			session.supabase
				.from("events")
				.insert({
					title: `NF-TEST CREATE ${Date.now()}`,
					group_id: groupId!,
					uploaded_by: session.userId,
					starts_at: now.toISOString(),
					ends_at: end.toISOString(),
				})
				.select("id")
				.single(),
		)

		expect(value.error, value.error?.message).toBeNull()
		if (value.data?.id != null) createdEventIds.push(value.data.id)

		record("Latencja CRUD (CREATE zdarzenie)", `${ms} ms`)
		expect(ms).toBeLessThan(BUDGETS.CRUD_LATENCY_MS)
	})

	it("Latencja CRUD (GET notatki) < 300 ms", async () => {
		const { value, ms } = await measure(() =>
			session.supabase
				.from("files")
				.select("id, object_id, group_id, uploaded_by, name, created_at")
				.eq("uploaded_by", session.userId)
				.eq("file_type", "note")
				.is("group_id", null)
				.order("created_at", { ascending: false }),
		)

		expect(value.error, value.error?.message).toBeNull()

		record("Latencja CRUD (GET notatki)", `${ms} ms`)
		expect(ms).toBeLessThan(BUDGETS.CRUD_LATENCY_MS)
	})
})
