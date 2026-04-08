<script setup lang="ts">
	import type { TableColumn } from "@nuxt/ui/runtime/types/index.js"

	import { watch } from "vue"

	type enrollItemsType = {
		universities: string[] | []
		faculties: string[] | []
		courses: string[] | []
		classes: string[] | []
	}

	const model = defineModel<enrollItemsType>("items")
	if (model.value) model.value.courses = []
	if (model.value) model.value.classes = []

	// internal row-selection from UTable (object mapping like { "1": true })
	const selectedRows = ref<Record<string, boolean>>({})

	watch(selectedRows, (rows) => {
		const selectedIds: string[] = []
		for (const [key, isSelected] of Object.entries(rows || {})) {
			if (!isSelected) continue
			const foundById = (coursesList.value || []).find(
				(item: any) => String(item.id) === String(key),
			)
			if (foundById) {
				selectedIds.push(String(foundById.id))
				continue
			}
			const index = Number(key)
			const foundByIndex = (coursesList.value || [])[index]
			if (foundByIndex) selectedIds.push(String(foundByIndex.id))
		}

		model.value = {
			...(model.value || {
				universities: [],
				faculties: [],
				courses: [],
				classes: [],
			}),
			courses: selectedIds,
		}
	})

	const client = useSupabaseClient()
	const { data: coursesList } = useAsyncData("courses", async () => {
		const facultiesIds = model.value?.faculties || []
		if (facultiesIds.length === 0) return []

		const courseGroups = await Promise.all(
			facultiesIds.map(async (facultyId) => {
				const { data, error } = await client.rpc("get_courses", {
					p_faculty_id: facultyId,
				})
				if (error) throw error
				return data ?? []
			}),
		)

		return courseGroups.flat()
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
	<UTable
		v-model:row-selection="selectedRows"
		:columns="columns"
		:loading="!coursesList"
		:data="coursesList || []" />
</template>
