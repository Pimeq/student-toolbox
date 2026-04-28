<script setup lang="ts">
import type { StepperItem } from "@nuxt/ui"

const client = useSupabaseClient()
const user = useSupabaseUser()
const toast = useToast()
const props = defineProps<{
	show: boolean
}>()
const open = ref(props.show)

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

function canGoNext(stepTitle: string | undefined) {
	if (!stepTitle) return false
	if (stepTitle === "Universities")
		return enrollItems.value.universities.length > 0
	if (stepTitle === "Faculties") return enrollItems.value.faculties.length > 0
	if (stepTitle === "Courses") return enrollItems.value.courses.length > 0
	if (stepTitle === "Classes") return enrollItems.value.classes.length > 0
	return false
}

type membershipType = {
	group_id: string
	user_id: string
	created_at: string
	role: "student"
}

const handleUserEnroll = async () => {
	if (!user.value) {
		return
	}
	const user_id = user.value.sub
	const date = new Date().toISOString()
	const selectedGroupIds = [
		...enrollItems.value.universities,
		...enrollItems.value.faculties,
		...enrollItems.value.courses,
		...enrollItems.value.classes,
	]
	const uniqueGroupIds = [...new Set(selectedGroupIds)]

	const inserts: membershipType[] = uniqueGroupIds.map((group_id) => ({
		group_id: group_id,
		created_at: date,
		role: "student",
		user_id: user_id,
	}))

	if (inserts.length === 0) return

	console.log(inserts)

	const { error } = await client.from("user_memberships").insert(inserts)
	if (error) {
		toast.add({
			title: "Error",
			description: "Failed to enroll user in selected groups.",
			color: "error",
		})
		return
	}

	toast.add({
		title: "Success",
		description: "You have been enrolled in the selected groups.",
		color: "success",
	})

	open.value = false
}
</script>

<template>
	<UModal v-model:open="open" :dismissible="false">
		<template #content>
			<UCard>
				<template #header>
					<h2 class="text-2xl font-bold">Welcome to the dashboard!</h2>
				</template>
				<div class="w-full">
					<UStepper disabled ref="stepper" :items="items">
						<template #content="{ item }">
							<StepperUniversity v-if="item.title == 'Universities'"
								v-model:items="enrollItems.universities" />
							<StepperFaculties v-if="item.title == 'Faculties'" v-model:items="enrollItems" />
							<StepperCourses v-if="item.title == 'Courses'" v-model:items="enrollItems" />
							<StepperClasses v-if="item.title == 'Classes'" v-model:items="enrollItems" />

							<div class="flex gap-2 justify-between mt-4">
								<UButton leading-icon="i-lucide-arrow-left" :disabled="!stepper?.hasPrev"
									@click="stepper?.prev()">
									Prev
								</UButton>

								<UButton v-if="item.title != 'Classes'" trailing-icon="i-lucide-arrow-right"
									:disabled="!stepper?.hasNext || !canGoNext(item.title)" @click="stepper?.next()">
									Next
								</UButton>
								<UButton v-else trailing-icon="i-lucide-arrow-right" :disabled="!canGoNext(item.title)"
									@click="handleUserEnroll">
									Submit
								</UButton>
							</div>
						</template>
					</UStepper>
				</div>
			</UCard>
		</template>
	</UModal>
</template>
