<script setup lang="ts">
	import type { Tables } from "~/types/database.types"

	definePageMeta({
		layout: "dashboard",
	})

	const { t, locale } = useI18n()
	const intlLocale = computed(() => (locale.value === "en" ? "en-US" : "pl-PL"))
	const supabase = useSupabaseClient()
	// getUser() returns { data: { user }, error }
	const {
		data: { user },
	} = await supabase.auth.getUser()
	const { fetchUserRoles, userRoles, getHighestRole } = useUserRole()

	// The actual user object
	const authUser = computed(() => user)
	const userId = computed(() => user?.id || "")
	const userEmail = computed(() => user?.email || "")
	const displayName = computed(() => {
		return (
			user?.user_metadata?.full_name || user?.email?.split("@")[0] || t("settings.userFallback")
		)
	})
	const accountCreated = computed(() => {
		if (!user?.created_at) return null
		return new Date(user.created_at)
	})

	// Fetch user's groups with roles
	const userMemberships = ref<
		(Tables<"groups"> & { role: Tables<"user_memberships">["role"] })[]
	>([])
	const membershipsLoading = ref(true)

	const loadMemberships = async () => {
		if (!userId.value) return
		membershipsLoading.value = true
		try {
			await fetchUserRoles()
			const groupIds = Object.keys(userRoles.value)
			if (groupIds.length === 0) {
				userMemberships.value = []
				return
			}

			const { data: groups, error } = await supabase
				.from("groups")
				.select("*")
				.in("id", groupIds)

			if (error) throw error

			userMemberships.value = (groups ?? []).map((group) => ({
				...group,
				role: userRoles.value[group.id],
			}))
		} catch (err) {
			console.error("Failed to load memberships:", err)
		} finally {
			membershipsLoading.value = false
		}
	}

	// Profile state
	const profileForm = ref({
		full_name: user?.user_metadata?.full_name || "",
	})

	// Password state
	const passwordForm = ref({
		newPassword: "",
		confirmPassword: "",
	})
	const passwordError = ref("")

	// UI state
	const savingProfile = ref(false)
	const savingPassword = ref(false)
	const activeTab = ref<"profile" | "security" | "groups">("profile")

	// Save profile - updates user_metadata with full_name
	const saveProfile = async () => {
		if (!user) return
		savingProfile.value = true

		try {
			const { error } = await supabase.auth.updateUser({
				data: { full_name: profileForm.value.full_name },
			})

			if (error) throw error
			alert(t("settings.alerts.profileUpdated"))
		} catch (error) {
			alert(t("settings.alerts.profileUpdateFailed", { message: (error as Error).message }))
		} finally {
			savingProfile.value = false
		}
	}

	// Change password
	const changePassword = async () => {
		passwordError.value = ""

		if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
			passwordError.value = t("settings.alerts.passwordsMismatch")
			return
		}

		if (passwordForm.value.newPassword.length < 6) {
			passwordError.value = t("settings.alerts.passwordTooShort")
			return
		}

		savingPassword.value = true

		try {
			const { error } = await supabase.auth.updateUser({
				password: passwordForm.value.newPassword,
			})

			if (error) throw error

			alert(t("settings.alerts.passwordChanged"))
			passwordForm.value = { newPassword: "", confirmPassword: "" }
		} catch (error) {
			alert(t("settings.alerts.passwordChangeFailed", { message: (error as Error).message }))
		} finally {
			savingPassword.value = false
		}
	}

	// Delete account
	const deletingAccount = ref(false)
	const deleteAccount = async () => {
		if (!confirm(t("settings.alerts.deleteConfirm1"))) {
			return
		}

		if (!confirm(t("settings.alerts.deleteConfirm2"))) {
			return
		}

		deletingAccount.value = true

		try {
			const { error } = await supabase.auth.signOut()
			if (error) throw error
			alert(t("settings.alerts.contactSupport"))
			await navigateTo("/")
		} catch (error) {
			alert(t("settings.alerts.signOutFailed", { message: (error as Error).message }))
			deletingAccount.value = false
		}
	}

	// Helpers
	const getGroupTypeColor = (type: string) => {
		switch (type) {
			case "university":
				return "primary"
			case "faculty":
				return "secondary"
			case "course":
				return "info"
			case "class":
				return "success"
			default:
				return "outline"
		}
	}

	const getRoleColor = (role: string) => {
		switch (role) {
			case "admin":
				return "primary"
			case "instructor":
				return "secondary"
			default:
				return "outline"
		}
	}

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString(intlLocale.value, {
			year: "numeric",
			month: "long",
			day: "numeric",
		})
	}

	onMounted(() => {
		loadMemberships()
	})
</script>

<template>
	<UDashboardPanel>
		<template #header>
			<UDashboardNavbar :title="t('settings.title')">
				<template #leading>
					<UDashboardSidebarCollapse />
				</template>
			</UDashboardNavbar>
		</template>

		<template #body>
			<div class="flex-1 overflow-y-auto p-6">
				<div class="max-w-3xl mx-auto">
					<!-- Page Header -->
					<div class="mb-6">
						<h1 class="text-2xl font-bold">{{ t('settings.title') }}</h1>
						<p class="text-sm text-gray-500 mt-1">
							{{ t('settings.subtitle') }}
						</p>
					</div>

					<!-- Tab Navigation -->
					<div
						class="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
						<button
							@click="activeTab = 'profile'"
							class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
							:class="
								activeTab === 'profile' ?
									'border-primary-500 text-primary-600'
								:	'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
							">
							{{ t('settings.tabs.profile') }}
						</button>
						<button
							@click="activeTab = 'security'"
							class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
							:class="
								activeTab === 'security' ?
									'border-primary-500 text-primary-600'
								:	'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
							">
							{{ t('settings.tabs.security') }}
						</button>
						<button
							@click="activeTab = 'groups'"
							class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
							:class="
								activeTab === 'groups' ?
									'border-primary-500 text-primary-600'
								:	'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
							">
							{{ t('settings.tabs.groups') }}
						</button>
					</div>

					<!-- Profile Tab -->
					<div
						v-if="activeTab === 'profile'"
						class="space-y-6">
						<UCard>
							<template #header>
								<h2 class="text-base font-semibold">{{ t('settings.profileInfo') }}</h2>
							</template>

							<div class="space-y-4">
								<div class="flex items-start gap-4">
									<UAvatar
										:placeholder="user?.email?.charAt(0).toUpperCase() || '?'"
										size="lg" />
									<div class="flex-1 space-y-4">
										<div>
											<label class="block text-sm font-medium mb-1.5"
												>{{ t('settings.email') }}</label
											>
											<UInput
												:modelValue="user?.email"
												disabled
												readonly />
											<p class="text-xs text-gray-500 mt-1">
												{{ t('settings.emailReadonly') }}
											</p>
										</div>

										<div>
											<label class="block text-sm font-medium mb-1.5"
												>{{ t('settings.fullName') }}</label
											>
											<UInput
												v-model="profileForm.full_name"
												:placeholder="t('settings.fullNamePlaceholder')" />
										</div>
									</div>
								</div>
							</div>

							<template #footer>
								<div class="flex items-center justify-between">
									<div class="text-xs text-gray-500">
										{{ t('settings.userId', { id: user?.id?.slice(0, 8) }) }}
									</div>
									<UButton
										:loading="savingProfile"
										@click="saveProfile">
										{{ t('settings.saveChanges') }}
									</UButton>
								</div>
							</template>
						</UCard>

						<UCard>
							<template #header>
								<h2 class="text-base font-semibold">{{ t('settings.accountDetails') }}</h2>
							</template>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<p class="text-xs text-gray-500 mb-1">{{ t('settings.memberSince') }}</p>
									<p class="text-sm font-medium">
										{{ user?.created_at ? formatDate(user.created_at) : t('common.na') }}
									</p>
								</div>
								<div>
									<p class="text-xs text-gray-500 mb-1">{{ t('settings.highestRole') }}</p>
									<p class="text-sm font-medium capitalize">
										{{ getHighestRole() || t('common.none') }}
									</p>
								</div>
							</div>
						</UCard>
					</div>

					<!-- Security Tab -->
					<div
						v-if="activeTab === 'security'"
						class="space-y-6">
						<UCard>
							<template #header>
								<div>
									<h2 class="text-base font-semibold">{{ t('settings.changePassword') }}</h2>
									<p class="text-xs text-gray-500 mt-1">
										{{ t('settings.changePasswordSubtitle') }}
									</p>
								</div>
							</template>

							<div class="space-y-4">
								<div>
									<label class="block text-sm font-medium mb-1.5"
										>{{ t('settings.newPassword') }}</label
									>
									<UInput
										v-model="passwordForm.newPassword"
										type="password"
										:placeholder="t('settings.newPasswordPlaceholder')" />
								</div>

								<div>
									<label class="block text-sm font-medium mb-1.5"
										>{{ t('settings.confirmPassword') }}</label
									>
									<UInput
										v-model="passwordForm.confirmPassword"
										type="password"
										:placeholder="t('settings.confirmPasswordPlaceholder')"
										@keyup.enter="changePassword" />
								</div>

								<p
									v-if="passwordError"
									class="text-sm text-red-500">
									{{ passwordError }}
								</p>
							</div>

							<template #footer>
								<div class="flex justify-end">
									<UButton
										:loading="savingPassword"
										@click="changePassword"
										:disabled="
											!passwordForm.newPassword || !passwordForm.confirmPassword
										">
										{{ t('settings.updatePassword') }}
									</UButton>
								</div>
							</template>
						</UCard>

						<UCard class="border-red-200 dark:border-red-900/50">
							<template #header>
								<div>
									<h2
										class="text-base font-semibold text-red-600 dark:text-red-400">
										{{ t('settings.dangerZone') }}
									</h2>
									<p class="text-xs text-gray-500 mt-1">{{ t('settings.irreversible') }}</p>
								</div>
							</template>

							<div class="space-y-4">
								<p class="text-sm text-gray-600 dark:text-gray-400">
									{{ t('settings.deleteWarning') }}
								</p>
							</div>

							<template #footer>
								<div class="flex justify-end">
									<UButton
										:loading="deletingAccount"
										color="error"
										variant="outline"
										@click="deleteAccount">
										{{ t('settings.deleteAccount') }}
									</UButton>
								</div>
							</template>
						</UCard>
					</div>

					<!-- Groups Tab -->
					<div
						v-if="activeTab === 'groups'"
						class="space-y-6">
						<UCard>
							<template #header>
								<div>
									<h2 class="text-base font-semibold">{{ t('settings.yourGroups') }}</h2>
									<p class="text-xs text-gray-500 mt-1">
										{{ t('settings.memberOfGroups', { count: userMemberships.length }) }}
									</p>
								</div>
							</template>

							<div
								v-if="membershipsLoading"
								class="text-center py-8 text-gray-500">
								{{ t('common.loading') }}
							</div>
							<div
								v-else-if="userMemberships.length === 0"
								class="text-center py-8 text-gray-500">
								{{ t('settings.notMemberOfGroups') }}
							</div>
							<div
								v-else
								class="divide-y">
								<div
									v-for="group in userMemberships"
									:key="group.id"
									class="flex items-center justify-between py-4 first:pt-0 last:pb-0">
									<div class="flex items-center gap-3">
										<div
											class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
											:style="{
												backgroundColor: `hsl(${group.name.charCodeAt(0) * 10}, 60%, 50%)`,
											}">
											{{ group.name.charAt(0).toUpperCase() }}
										</div>
										<div>
											<h3 class="font-medium">{{ group.name }}</h3>
											<div class="flex items-center gap-2 mt-0.5">
												<UBadge
													:color="getGroupTypeColor(group.type)"
													size="xs">
													{{ t(`groupType.${group.type}`) }}
												</UBadge>
												<span class="text-xs text-gray-500"
													>{{ t('settings.groupId', { id: group.id.slice(0, 8) }) }}</span
												>
											</div>
										</div>
									</div>
									<UBadge
										:color="getRoleColor(group.role)"
										variant="subtle">
										{{ t(`role.${group.role}`) }}
									</UBadge>
								</div>
							</div>
						</UCard>
					</div>
				</div>
			</div>
		</template>
	</UDashboardPanel>
</template>
