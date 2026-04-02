<script setup lang="ts">
	import type { TableColumn } from "@nuxt/ui/runtime/types/index.js"

	import { watch } from "vue"

	const model = defineModel<string[]>("items")

	// internal row-selection from UTable (object mapping like { "1": true }), synced to `model` as an array of group ids
	const selectedRows = ref<Record<string, boolean> | any[]>([])

	watch(selectedRows, (rows) => {
		if (!rows) {
			model.value = []
			return
		}

		// If rows is an object mapping keys -> boolean, map keys to ids.
		const keys = Object.keys(rows || {})
		const selectedIds: string[] = []
		for (const k of keys) {
			if (!rows[k]) continue
			// try to find a uni with id === k
			const foundById = (uniList?.value || []).find(
				(u: any) => String(u.id) === String(k),
			)
			if (foundById) {
				selectedIds.push(String(foundById.id))
				continue
			}
			// fallback: treat key as index
			const idx = Number(k)
			const foundByIndex = (uniList?.value || [])[idx]
			if (foundByIndex) selectedIds.push(String(foundByIndex.id))
		}
		model.value = selectedIds
	})

	const client = useSupabaseClient()
	const { data: uniList } = useAsyncData("universities", async () => {
		const { data, error } = await client.rpc("get_universities")
		if (error) throw error
		return data
	})

	type Group = {
		name: string
	}

	const UCheckbox = resolveComponent("UCheckbox")
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
	]
</script>

<template>
	{{ model }}
	<UTable
		v-model:row-selection="selectedRows"
		:columns="columns"
		:data="uniList" />
</template>
