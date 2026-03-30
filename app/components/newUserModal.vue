<script setup lang="ts">
	import type { TableColumn } from "@nuxt/ui/runtime/types/index.js"

	const props = defineProps<{
		show: boolean
	}>()
	const open = ref(props.show)
	const client = useSupabaseClient()

	const tabItems = [
		{ label: "Join", icon: "i-heroicons-user-plus", slot: "join" },
		{ label: "Create new", icon: "i-heroicons-plus", slot: "create" },
	]

	const { data: availableGroups } = useAsyncData(async () => {
		const { data } = await client.from("Groups").select(`
		name,
		owner
		`)
		return data
	})

	type Group = {
		name: string
		owner: string
	}

	const UCheckbox = resolveComponent("UCheckbox")
	const UBadge = resolveComponent("UBadge")
	const columns: TableColumn<Group>[] = [
		{
			id: "select",
			header: ({ table }) =>
				h(UCheckbox, {
					modelValue:
						table.getIsSomePageRowsSelected() ? "indeterminate" : (
							table.getIsAllPageRowsSelected()
						),
					"onUpdate:modelValue": (value: boolean | "indeterminate") =>
						table.toggleAllPageRowsSelected(!!value),
					"aria-label": "Select all",
				}),
			cell: ({ row }) =>
				h(UCheckbox, {
					modelValue: row.getIsSelected(),
					"onUpdate:modelValue": (value: boolean | "indeterminate") =>
						row.toggleSelected(!!value),
					"aria-label": "Select row",
				}),
		},
		{
			accessorKey: "name",
			header: "Name",
		},
		{
			accessorKey: "owner",
			header: "Owner",
		},
	]
</script>

<template>
	<UModal
		v-model:open="open"
		:dismissible="false">
		<template #content>
			<UCard>
				<template #header>
					<h2 class="text-2xl font-bold">Welcome to the dashboard!</h2>
					before we proceeed please join or create a group
				</template>
				<UTabs :items="tabItems">
					<template #join>
						<!-- this error is because of unupdated db types, just update the types and it'll be good -->
						<UTable
							:data="availableGroups ?? []"
							:columns="columns">
						</UTable>
					</template>
					<template #create>
						<UserModalTabsAddNewGroup />
					</template>
				</UTabs>

				<template #footer> </template>
			</UCard>
		</template>
	</UModal>
</template>
