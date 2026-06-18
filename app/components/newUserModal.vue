<script setup lang="ts">
import type { StepperItem } from "@nuxt/ui"

const { t } = useI18n()
const client = useSupabaseClient()
const user = useSupabaseUser()
const toast = useToast()
const props = defineProps<{
	show: boolean
}>()
const open = ref(props.show)

const items = computed<StepperItem[]>(() => [
	{
		value: "Universities",
		title: t("onboarding.steps.universities"),
		icon: "i-heroicons-building-office-2-solid",
	},
	{
		value: "Faculties",
		title: t("onboarding.steps.faculties"),
		icon: "i-heroicons-academic-cap-solid",
	},
	{
		value: "Courses",
		title: t("onboarding.steps.courses"),
		icon: "i-heroicons-book-open-solid",
	},
	{
		value: "Classes",
		title: t("onboarding.steps.classes"),
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

function canGoNext(stepValue: string | undefined) {
	if (!stepValue) return false
	if (stepValue === "Universities")
		return enrollItems.value.universities.length > 0
	if (stepValue === "Faculties") return enrollItems.value.faculties.length > 0
	if (stepValue === "Courses") return enrollItems.value.courses.length > 0
	if (stepValue === "Classes") return enrollItems.value.classes.length > 0
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
			title: t("common.error"),
			description: t("onboarding.enrollFailed"),
			color: "error",
		})
		return
	}

	toast.add({
		title: t("common.success"),
		description: t("onboarding.enrollSuccess"),
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
					<h2 class="text-2xl font-bold">{{ t('onboarding.welcome') }}</h2>
				</template>
				<div class="w-full">
					<UStepper disabled ref="stepper" :items="items">
						<template #content="{ item }">
							<StepperUniversity v-if="item.value == 'Universities'"
								v-model:items="enrollItems.universities" />
							<StepperFaculties v-if="item.value == 'Faculties'" v-model:items="enrollItems" />
							<StepperCourses v-if="item.value == 'Courses'" v-model:items="enrollItems" />
							<StepperClasses v-if="item.value == 'Classes'" v-model:items="enrollItems" />

							<div class="flex gap-2 justify-between mt-4">
								<UButton leading-icon="i-lucide-arrow-left" :disabled="!stepper?.hasPrev"
									@click="stepper?.prev()">
									{{ t('onboarding.prev') }}
								</UButton>

								<UButton v-if="item.value != 'Classes'" trailing-icon="i-lucide-arrow-right"
									:disabled="!stepper?.hasNext || !canGoNext(item.value)" @click="stepper?.next()">
									{{ t('onboarding.next') }}
								</UButton>
								<UButton v-else trailing-icon="i-lucide-arrow-right" :disabled="!canGoNext(item.value)"
									@click="handleUserEnroll">
									{{ t('onboarding.submit') }}
								</UButton>
							</div>
						</template>
					</UStepper>
				</div>
			</UCard>
		</template>
	</UModal>
</template>
