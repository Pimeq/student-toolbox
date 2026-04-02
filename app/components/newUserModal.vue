<script setup lang="ts">
	const props = defineProps<{
		show: boolean
	}>()
	const open = ref(props.show)

	import type { StepperItem } from "@nuxt/ui"

	const items = ref<StepperItem[]>([
		{
			title: "Universities",
			icon: "i-heroicons-building-office-2-solid",
		},
		{
			title: "Faculties",
			icon: "i-heroicons-academic-cap-solid",
		},
		{
			title: "Courses",
			icon: "i-heroicons-book-open-solid",
		},
		{
			title: "Classes",
			icon: "i-heroicons-users-solid",
		},
	])

	const stepper = useTemplateRef("stepper")

	type enrollItemsType = {
		universities: string[] | []
		faculties: string[] | []
		courses: string[] | []
		classes: string[] | []
	}

	const enrollItems = ref<enrollItemsType>({
		universities: [],
		faculties: [],
		courses: [],
		classes: [],
	})
</script>

<template>
	<UModal
		v-model:open="open"
		:dismissible="false">
		<template #content>
			<UCard>
				<template #header>
					<h2 class="text-2xl font-bold">Welcome to the dashboard!</h2>
				</template>
				<div class="w-full">
					<UStepper
						ref="stepper"
						:items="items">
						<template #content="{ item }">
							<StepperUniversity
								v-if="item.title == 'Universities'"
								v-model:items="enrollItems.universities" />
						</template>
					</UStepper>

					<div class="flex gap-2 justify-between mt-4">
						<UButton
							leading-icon="i-lucide-arrow-left"
							:disabled="!stepper?.hasPrev"
							@click="stepper?.prev()">
							Prev
						</UButton>

						<UButton
							trailing-icon="i-lucide-arrow-right"
							:disabled="!stepper?.hasNext"
							@click="stepper?.next()">
							Next
						</UButton>
					</div>
				</div>
			</UCard>
		</template>
	</UModal>
</template>
