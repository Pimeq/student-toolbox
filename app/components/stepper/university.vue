<script setup lang="ts">
	import type { TableColumn } from "@nuxt/ui/runtime/types/index.js"

	import { watch } from "vue"

	const model = defineModel<string[]>("items")

	const client = useSupabaseClient()
	const { data: uniList, pending } = useAsyncData("universities", async () => {
		const { data, error } = await client.rpc("get_universities")
		if (error) throw error
		return data
	})

	// internal row-selection from UTable (object mapping like { "1": true })
	const selectedRows = ref<Record<string, boolean>>({})

	function sameIds(left: string[] = [], right: string[] = []) {
		return (
			left.length === right.length &&
			left.every((id, index) => id === right[index])
		)
	}

	function syncRowsFromModel() {
		const universities = uniList.value || []
		const nextSelection: Record<string, boolean> = {}

		for (const [index, item] of universities.entries()) {
			if (model.value?.includes(String(item.id))) {
				nextSelection[String(index)] = true
			}
		}

		selectedRows.value = nextSelection
	}

	watch(selectedRows, (rows) => {
		const universities = uniList.value || []
		const selectedIds: string[] = []

		for (const [key, isSelected] of Object.entries(rows || {})) {
			if (!isSelected) continue
			const index = Number(key)
			const found = universities[index]
			if (found?.id) selectedIds.push(String(found.id))
		}

		if (!sameIds(model.value || [], selectedIds)) {
			model.value = selectedIds
		}
	})

	watch(
		[model, uniList],
		() => {
			syncRowsFromModel()
		},
		{ immediate: true },
	)

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
	<UTable
		v-model:row-selection="selectedRows"
		:columns="columns"
		:loading="pending"
		:data="uniList" />
</template>
