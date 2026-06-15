<script setup lang="ts">
	import type { Tables } from "~/types/database.types"

	definePageMeta({
		layout: "dashboard",
	})

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
			user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"
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
			alert("Profile updated successfully!")
		} catch (error) {
			alert("Failed to update profile: " + (error as Error).message)
		} finally {
			savingProfile.value = false
		}
	}

	// Change password
	const changePassword = async () => {
		passwordError.value = ""

		if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
			passwordError.value = "Passwords do not match"
			return
		}

		if (passwordForm.value.newPassword.length < 6) {
			passwordError.value = "Password must be at least 6 characters"
			return
		}

		savingPassword.value = true

		try {
			const { error } = await supabase.auth.updateUser({
				password: passwordForm.value.newPassword,
			})

			if (error) throw error

			alert("Password changed successfully!")
			passwordForm.value = { newPassword: "", confirmPassword: "" }
		} catch (error) {
			alert("Failed to change password: " + (error as Error).message)
		} finally {
			savingPassword.value = false
		}
	}

	// Delete account
	const deletingAccount = ref(false)
	const deleteAccount = async () => {
		if (
			!confirm(
				"Are you sure you want to delete your account? This action cannot be undone.",
			)
		) {
			return
		}

		if (!confirm("This will delete all your data. Are you REALLY sure?")) {
			return
		}

		deletingAccount.value = true

		try {
			const { error } = await supabase.auth.signOut()
			if (error) throw error
			alert(
				"Please contact support to delete your account. You have been signed out.",
			)
			await navigateTo("/")
		} catch (error) {
			alert("Failed to sign out: " + (error as Error).message)
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
		return new Date(dateString).toLocaleDateString("en-US", {
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
			<UDashboardNavbar title="Settings">
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
						<h1 class="text-2xl font-bold">Settings</h1>
						<p class="text-sm text-gray-500 mt-1">
							Manage your account preferences
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
							Profile
						</button>
						<button
							@click="activeTab = 'security'"
							class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
							:class="
								activeTab === 'security' ?
									'border-primary-500 text-primary-600'
								:	'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
							">
							Security
						</button>
						<button
							@click="activeTab = 'groups'"
							class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
							:class="
								activeTab === 'groups' ?
									'border-primary-500 text-primary-600'
								:	'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
							">
							Groups
						</button>
					</div>

					<!-- Profile Tab -->
					<div
						v-if="activeTab === 'profile'"
						class="space-y-6">
						<UCard>
							<template #header>
								<h2 class="text-base font-semibold">Profile Information</h2>
							</template>

							<div class="space-y-4">
								<div class="flex items-start gap-4">
									<UAvatar
										:placeholder="user?.email?.charAt(0).toUpperCase() || '?'"
										size="lg" />
									<div class="flex-1 space-y-4">
										<div>
											<label class="block text-sm font-medium mb-1.5"
												>Email</label
											>
											<UInput
												:modelValue="user?.email"
												disabled
												readonly />
											<p class="text-xs text-gray-500 mt-1">
												Email cannot be changed
											</p>
										</div>

										<div>
											<label class="block text-sm font-medium mb-1.5"
												>Full Name</label
											>
											<UInput
												v-model="profileForm.full_name"
												placeholder="Enter your name" />
										</div>
									</div>
								</div>
							</div>

							<template #footer>
								<div class="flex items-center justify-between">
									<div class="text-xs text-gray-500">
										User ID: {{ user?.id?.slice(0, 8) }}...
									</div>
									<UButton
										:loading="savingProfile"
										@click="saveProfile">
										Save Changes
									</UButton>
								</div>
							</template>
						</UCard>

						<UCard>
							<template #header>
								<h2 class="text-base font-semibold">Account Details</h2>
							</template>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<p class="text-xs text-gray-500 mb-1">Member Since</p>
									<p class="text-sm font-medium">
										{{ user?.created_at ? formatDate(user.created_at) : "N/A" }}
									</p>
								</div>
								<div>
									<p class="text-xs text-gray-500 mb-1">Highest Role</p>
									<p class="text-sm font-medium capitalize">
										{{ getHighestRole() || "None" }}
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
									<h2 class="text-base font-semibold">Change Password</h2>
									<p class="text-xs text-gray-500 mt-1">
										Update your account password
									</p>
								</div>
							</template>

							<div class="space-y-4">
								<div>
									<label class="block text-sm font-medium mb-1.5"
										>New Password</label
									>
									<UInput
										v-model="passwordForm.newPassword"
										type="password"
										placeholder="Enter new password" />
								</div>

								<div>
									<label class="block text-sm font-medium mb-1.5"
										>Confirm Password</label
									>
									<UInput
										v-model="passwordForm.confirmPassword"
										type="password"
										placeholder="Confirm new password"
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
										Update Password
									</UButton>
								</div>
							</template>
						</UCard>

						<UCard class="border-red-200 dark:border-red-900/50">
							<template #header>
								<div>
									<h2
										class="text-base font-semibold text-red-600 dark:text-red-400">
										Danger Zone
									</h2>
									<p class="text-xs text-gray-500 mt-1">Irreversible actions</p>
								</div>
							</template>

							<div class="space-y-4">
								<p class="text-sm text-gray-600 dark:text-gray-400">
									Once you delete your account, there is no going back. All your
									data will be permanently removed.
								</p>
							</div>

							<template #footer>
								<div class="flex justify-end">
									<UButton
										:loading="deletingAccount"
										color="error"
										variant="outline"
										@click="deleteAccount">
										Delete Account
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
									<h2 class="text-base font-semibold">Your Groups</h2>
									<p class="text-xs text-gray-500 mt-1">
										{{ userMemberships.length }} group{{
											userMemberships.length !== 1 ? "s" : ""
										}}
										you're a member of
									</p>
								</div>
							</template>

							<div
								v-if="membershipsLoading"
								class="text-center py-8 text-gray-500">
								Loading...
							</div>
							<div
								v-else-if="userMemberships.length === 0"
								class="text-center py-8 text-gray-500">
								You are not a member of any groups yet.
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
													{{ group.type }}
												</UBadge>
												<span class="text-xs text-gray-500"
													>ID: {{ group.id.slice(0, 8) }}...</span
												>
											</div>
										</div>
									</div>
									<UBadge
										:color="getRoleColor(group.role)"
										variant="subtle">
										{{ group.role }}
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
