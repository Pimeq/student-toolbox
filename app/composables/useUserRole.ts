import { useSupabaseClient, useSupabaseUser } from '#imports'
import type { Tables } from '~/types/database.types'

export const useUserRole = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const userRoles = ref<Record<string, Tables<'user_memberships'>['role']>>({})
  const isLoading = ref(false)

  const fetchUserRoles = async () => {
    if (!user.value) return {}
    isLoading.value = true
    try {
      const { data, error } = await supabase
        .from('user_memberships')
        .select('group_id, role')
        .eq('user_id', user.value.sub)

      if (error) throw error

      const roles: Record<string, Tables<'user_memberships'>['role']> = {}
      data?.forEach((membership) => {
        roles[membership.group_id] = membership.role
      })
      userRoles.value = roles
      return roles
    } finally {
      isLoading.value = false
    }
  }

  const hasRole = (groupId: string, requiredRole: Tables<'user_memberships'>['role']): boolean => {
    const role = userRoles.value[groupId]
    if (!role) return false

    const roleHierarchy: Record<Tables<'user_memberships'>['role'], number> = {
      student: 1,
      instructor: 2,
      admin: 3,
    }
    return roleHierarchy[role] >= roleHierarchy[requiredRole]
  }

  const isAdmin = (groupId?: string): boolean => {
    if (groupId) {
      return hasRole(groupId, 'admin')
    }
    return Object.values(userRoles.value).some((role) => role === 'admin')
  }

  const isInstructor = (groupId?: string): boolean => {
    if (groupId) {
      return hasRole(groupId, 'instructor')
    }
    return Object.values(userRoles.value).some((role) => role === 'instructor' || role === 'admin')
  }

  const getHighestRole = (): Tables<'user_memberships'>['role'] | null => {
    const roles = Object.values(userRoles.value)
    if (roles.includes('admin')) return 'admin'
    if (roles.includes('instructor')) return 'instructor'
    if (roles.includes('student')) return 'student'
    return null
  }

  return {
    userRoles,
    isLoading,
    fetchUserRoles,
    hasRole,
    isAdmin,
    isInstructor,
    getHighestRole,
  }
}