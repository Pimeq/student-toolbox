<script setup lang="ts">
	import * as z from "zod"
	import type { FormSubmitEvent } from "@nuxt/ui"

	const toast = useToast()
	const user = useSupabaseUser()

	const client = useSupabaseClient()

	const newGroupSchema = z.object({
		name: z.string("Invaid Name").min(5).max(30),
		created_at: z.coerce.date(),
		owner_user_id: z.uuid(),
		owner: z.email(),
	})

	type Schema = z.output<typeof newGroupSchema>

	const newGroupState = reactive<Partial<Schema>>({
		name: undefined,
		created_at: new Date(),
		owner_user_id: user.value?.sub,
		owner: user.value?.email,
	})

	const newGroupLoading = ref(false)
	const handleNewGroupSubmit = async (event: FormSubmitEvent<Schema>) => {
		newGroupLoading.value = true
		const parsed = newGroupSchema.parse(newGroupState)
		const res = await client
			.from("Groups")
			.insert({
				name: parsed.name,
				created_at: parsed.created_at.toISOString(),
				owner_user_id: parsed.owner_user_id,
				owner: parsed.owner,
			})
			.select("*")

		if (res.error) {
			toast.add({
				title: "Error creating group",
				description: res.error.message,
				color: "error",
			})
		} else {
			if (res.data && res.data[0]?.id && user.value?.sub) {
				const addRes = await client.from("GroupMembers").insert([
					{
						group_id: res.data[0].id,
						user_id: user.value.sub,
						created_at: new Date().toISOString(),
					},
				])

				if (!addRes.error) {
					toast.add({
						title: "Group created successfully!",
						description: "Congrats!",
					})
				} else {
					toast.add({
						title: "Group Created but unable to add user",
						description: addRes.error.message,
						color: "error",
					})
				}
			}
		}
		newGroupLoading.value = false
	}
</script>

<template>
	<UContainer>
		<UForm
			class="space-y-2"
			:schema="newGroupSchema"
			:state="newGroupState"
			@submit="handleNewGroupSubmit">
			<UFormField
				label="Group Name"
				name="name">
				<UInput
					class="w-full"
					v-model="newGroupState.name" />
			</UFormField>

			<UButton
				:loading="newGroupLoading"
				class="mt-1"
				type="submit">
				Submit
			</UButton>
		</UForm>
	</UContainer>
</template>
