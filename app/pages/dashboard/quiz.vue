<script setup lang="ts">
const isDragging = ref(false)
const fileText = ref<string | null>(null)
const questionCount = ref<number>(5)
const loading = ref(false)
const errorMsg = ref<string | null>(null)

type QuizQuestion = {
	question: string
	answers: string[]
	correct: number
}
const quiz = ref<QuizQuestion[]>([])
const userAnswers = ref<Record<number, number>>({})
const isQuizSubmitted = ref(false)

const score = computed(() => {
	let correctCount = 0
	quiz.value.forEach((q, i) => {
		if (userAnswers.value[i] === q.correct) correctCount++
	})
	return correctCount
})

function onDragOver() {
	isDragging.value = true
}

function onDragLeave() {
	isDragging.value = false
}

function onDrop(e: DragEvent) {
	isDragging.value = false
	const files = e.dataTransfer?.files
	if (!files || files.length === 0) return

	const file = files[0]
	if (!file.name.endsWith(".md")) {
		errorMsg.value = "Niepoprawny format. Proszę upuścić plik .md"
		return
	}

	errorMsg.value = null
	const reader = new FileReader()
	reader.onload = (event) => {
		fileText.value = event.target?.result as string
	}
	reader.onerror = () => {
		errorMsg.value = "Wystąpił błąd podczas odczytu pliku."
	}
	reader.readAsText(file)
}

async function generateQuiz() {
	if (!fileText.value) return

	loading.value = true
	errorMsg.value = null
	quiz.value = []
	userAnswers.value = {}
	isQuizSubmitted.value = false

	try {
		const res = await $fetch<{ quiz: QuizQuestion[] }>("/api/generate-quiz", {
			method: "POST",
			body: {
				text: fileText.value,
				questionCount: questionCount.value,
			},
		})

		if (res && res.quiz) {
			quiz.value = res.quiz
		}
	} catch (err: any) {
		errorMsg.value = err.data?.message || "Nie udało się wygenerować quizu."
	} finally {
		loading.value = false
	}
}
</script>

<template>
	<div class="max-w-4xl mx-auto p-4 space-y-8">
		<UCard>
			<template #header>
				<h2 class="text-2xl font-bold flex items-center gap-2">
					<UIcon name="i-heroicons-sparkles" class="text-primary"/>
					AI Quiz Generator
				</h2>
			</template>

			<div 
				@dragover.prevent="onDragOver"
				@dragleave.prevent="onDragLeave"
				@drop.prevent="onDrop"
				:class="[
					'border-2 border-dashed rounded-lg p-10 text-center transition-colors relative cursor-pointer',
					isDragging ? 'border-primary bg-primary-50 dark:bg-primary-950/20' : 'border-gray-300 dark:border-gray-700',
					fileText ? 'bg-green-50/50 dark:bg-green-900/10 border-green-300' : ''
				]"
			>
				<div v-if="!fileText" class="flex flex-col items-center justify-center gap-3 text-gray-500 pointer-events-none">
					<UIcon name="i-heroicons-document-arrow-down" class="w-12 h-12 text-gray-400" />
					<p class="text-lg">Przeciągnij i upuść swoje notatki w <strong>.md</strong> tutaj</p>
				</div>

				<div v-else class="flex flex-col items-center justify-center gap-3 text-green-600 dark:text-green-400">
					<UIcon name="i-heroicons-check-circle" class="w-12 h-12" />
					<p class="text-lg font-medium">Plik odczytany ({{ fileText.length }} znaków)</p>
					<UButton size="xs" variant="ghost" color="gray" @click.stop="fileText = null" label="Usuń plik i załaduj ponownie" />
				</div>
			</div>

			<div class="mt-6 flex flex-col sm:flex-row gap-4 items-end sm:items-center">
				<UFormGroup label="Liczba pytań" class="w-full sm:w-48">
					<UInput 
						v-model="questionCount" 
						type="number" 
						min="1" 
						max="20"
						icon="i-heroicons-list-bullet"
					/>
				</UFormGroup>
				
				<UButton 
					@click="generateQuiz" 
					:loading="loading" 
					:disabled="!fileText"
					icon="i-heroicons-cpu-chip"
					size="lg"
					class="w-full sm:w-auto ml-auto"
				>
					{{ loading ? 'Generowanie...' : 'Generuj Quiz' }}
				</UButton>
			</div>

			<UAlert 
				v-if="errorMsg" 
				color="red" 
				icon="i-heroicons-exclamation-triangle" 
				:title="errorMsg" 
				class="mt-4"
			/>
		</UCard>

		<div v-if="quiz.length > 0" class="space-y-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<UIcon name="i-heroicons-academic-cap" class="w-8 h-8 text-primary"/>
					<h3 class="text-3xl font-bold">Twój Quiz</h3>
				</div>
			</div>
			
			<UCard v-for="(q, index) in quiz" :key="index" class="relative shadow-sm hover:shadow transition-shadow">
				<div class="font-semibold text-xl mb-6">
					<span class="text-primary mr-2">{{ index + 1 }}.</span> {{ q.question }}
				</div>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div 
						v-for="(answer, aIndex) in q.answers" 
						:key="aIndex"
						@click="!isQuizSubmitted && (userAnswers[index] = aIndex)"
						:class="[
							'p-4 rounded-lg border text-base flex items-start gap-3 transition-all',
							!isQuizSubmitted ? (
								userAnswers[index] === aIndex 
									? 'bg-primary-50 border-primary-300 text-primary-900 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300 ring-2 ring-primary-500 cursor-pointer' 
									: 'bg-white border-gray-200 text-gray-700 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
							) : (
								aIndex === q.correct
									? 'bg-green-50 border-green-300 text-green-900 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300 ring-2 ring-green-500 opacity-100'
									: userAnswers[index] === aIndex
										? 'bg-red-50 border-red-300 text-red-900 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 ring-2 ring-red-500 opacity-100'
										: 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800/30 dark:border-gray-700 dark:text-gray-500 opacity-50 cursor-not-allowed'
							)
						]"
					>
						<!-- Check icon for user's selection while taking the quiz -->
						<UIcon 
							v-if="!isQuizSubmitted && userAnswers[index] === aIndex" 
							name="i-heroicons-check-circle-solid" 
							class="w-6 h-6 text-primary-500 shrink-0 mt-0.5" 
						/>
						<!-- Blank circle if not selected and not submitted -->
						<div 
							v-else-if="!isQuizSubmitted" 
							class="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0 mt-0.5" 
						></div>

						<!-- Results icons -->
						<UIcon 
							v-if="isQuizSubmitted && aIndex === q.correct" 
							name="i-heroicons-check-circle-solid" 
							class="w-6 h-6 text-green-500 shrink-0 mt-0.5" 
						/>
						<UIcon 
							v-else-if="isQuizSubmitted && userAnswers[index] === aIndex && aIndex !== q.correct" 
							name="i-heroicons-x-circle-solid" 
							class="w-6 h-6 text-red-500 shrink-0 mt-0.5" 
						/>
						<div 
							v-else-if="isQuizSubmitted" 
							class="w-6 h-6 shrink-0 mt-0.5" 
						></div>

						<span class="leading-relaxed">{{ answer }}</span>
					</div>
				</div>
			</UCard>

			<!-- Submit & Results Section -->
			<UCard class="text-center p-4">
				<div v-if="!isQuizSubmitted">
					<UButton 
						color="primary" 
						size="xl" 
						icon="i-heroicons-paper-airplane"
						@click="isQuizSubmitted = true"
					>
						Sprawdź odpowiedzi
					</UButton>
					<p class="text-sm text-gray-500 mt-2">
						Wypełniono {{ Object.keys(userAnswers).length }} z {{ quiz.length }} pytań
					</p>
				</div>
				<div v-else class="space-y-4">
					<h4 class="text-2xl font-bold">Twój wynik</h4>
					<div class="text-5xl font-black mb-2" :class="score === quiz.length ? 'text-green-500' : (score > quiz.length / 2 ? 'text-primary' : 'text-red-500')">
						{{ score }} / {{ quiz.length }}
					</div>
					<UProgress 
						:value="score" 
						:max="quiz.length" 
						color="primary"
						class="max-w-md mx-auto my-4" 
					/>
					<UButton 
						color="gray" 
						variant="ghost" 
						icon="i-heroicons-arrow-path"
						@click="() => { isQuizSubmitted = false; userAnswers = {} }"
					>
						Spróbuj ponownie
					</UButton>
				</div>
			</UCard>
		</div>
	</div>
</template>