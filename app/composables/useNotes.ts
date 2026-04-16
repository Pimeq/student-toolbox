import { useState } from '#imports'

export const useNotes = () => {
  const notes = useState<any[]>('user-notes', () => [])
  
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const getCurrentUserId = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    return currentUser?.id || user.value?.id || (user.value as any)?.sub || null
  }

  const getUserMemberships = async (currentUserId: string) => {
    const { data: memberships, error } = await supabase
      .from('user_memberships')
      .select('group_id, role, created_at')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return (memberships || []).filter(membership => Boolean(membership.group_id))
  }

  const getMembershipGroupIds = async (currentUserId: string) => {
    const memberships = await getUserMemberships(currentUserId)
    return memberships.map(membership => membership.group_id)
  }

  const getUserGroups = async () => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) return []

    const memberships = await getUserMemberships(currentUserId)
    if (memberships.length === 0) return []

    const uniqueGroupIds = [...new Set(memberships.map(membership => membership.group_id))]

    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, type')
      .in('id', uniqueGroupIds)

    if (groupsError) throw groupsError

    const groupsById = new Map((groups || []).map(group => [group.id, group]))

    return memberships
      .map(membership => {
        const group = groupsById.get(membership.group_id)
        if (!group) return null

        return {
          ...group,
          role: membership.role
        }
      })
      .filter(Boolean)
  }

  const extractPreview = (content: string) => {
    const plainText = content.replace(/[#*_~`>[\]]/g, '').trim()
    if (!plainText) return 'Pusta notatka'
    return plainText.length > 100 ? `${plainText.substring(0, 100)}...` : plainText
  }

  const extractFirstH1 = (content: string) => {
    const match = content.match(/^#(?!#)\s+(.+)$/m)
    return match?.[1]?.trim() || null
  }

  const syncFirstH1WithTitle = (content: string, rawTitle: string) => {
    const safeTitle = rawTitle.trim() || 'Nowa Notatka'
    const normalized = content || ''

    if (!normalized.trim()) {
      return `# ${safeTitle}\n\n`
    }

    const lines = normalized.split(/\r?\n/)
    const firstH1Index = lines.findIndex(line => /^#(?!#)\s+/.test(line))

    if (firstH1Index >= 0) {
      lines[firstH1Index] = `# ${safeTitle}`
      return lines.join('\n')
    }

    return `# ${safeTitle}\n\n${normalized.replace(/^\s+/, '')}`
  }

  const resolveStoragePath = async (ownerUserId: string, objectId: string) => {
    const { data: list, error: listError } = await supabase.storage
      .from('files')
      .list(`notes/${ownerUserId}`, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (listError || !list) {
      throw new Error(`Nie udało się odczytać listy plików notatek: ${listError?.message || 'brak danych'}`)
    }

    const fileInfo = list.find(file => file.id === objectId)
    if (!fileInfo) {
      return null
    }

    return `notes/${ownerUserId}/${fileInfo.name}`
  }

  const fetchNotes = async () => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) return

    const existingById = new Map(notes.value.map(note => [note.id, note]))

    const membershipGroupIds = await getMembershipGroupIds(currentUserId)

    const { data: personalData, error: personalError } = await supabase
      .from('files')
      .select('*')
      .eq('uploaded_by', currentUserId)
      .is('group_id', null)
      .eq('file_type', 'note')
      .order('created_at', { ascending: false })

    if (personalError) {
      console.error('Błąd pobierania notatek personalnych:', personalError)
      return
    }

    let sharedData: any[] = []
    if (membershipGroupIds.length > 0) {
      const { data: groupData, error: groupError } = await supabase
        .from('files')
        .select('*')
        .in('group_id', membershipGroupIds)
        .eq('file_type', 'note')
        .order('created_at', { ascending: false })

      if (groupError) {
        console.error('Błąd pobierania notatek współdzielonych:', groupError)
      } else {
        sharedData = groupData || []
      }
    }

    const mergedByObjectId = new Map<string, any>()
    for (const row of [...sharedData, ...(personalData || [])]) {
      mergedByObjectId.set(row.object_id, row)
    }

    const data = [...mergedByObjectId.values()].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    
    // Mapujemy z bazy na lokalny format
    notes.value = data.map(dbFile => {
      const existingNote = existingById.get(dbFile.object_id)

      return {
        id: dbFile.object_id,
        database_id: dbFile.id,
        group_id: dbFile.group_id,
        shared_group_id: dbFile.group_id || existingNote?.shared_group_id || null,
        uploaded_by: dbFile.uploaded_by,
        is_owner: dbFile.uploaded_by === currentUserId,
        visibility: dbFile.group_id ? 'shared' : 'personal',
        title: dbFile.name,
        content: existingNote?.content || '',
        preview: existingNote?.preview || 'Ładowanie podglądu...',
        updated_at: existingNote?.updated_at || dbFile.created_at,
        color: existingNote?.color || 'emerald' // domyślnie
      }
    })

    const fileNameByOwner = new Map<string, Map<string, string>>()
    const ownerIds = [...new Set(notes.value.map(note => note.uploaded_by).filter(Boolean))]

    await Promise.all(ownerIds.map(async (ownerId: string) => {
      const { data: storageList, error: storageListError } = await supabase.storage
        .from('files')
        .list(`notes/${ownerId}`, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        })

      if (storageListError || !storageList) {
        console.error(`Błąd listowania plików notatek dla użytkownika ${ownerId}:`, storageListError)
        fileNameByOwner.set(ownerId, new Map())
        return
      }

      const safeEntries = storageList
        .filter(file => Boolean(file.id))
        .map(file => [file.id as string, file.name] as const)

      fileNameByOwner.set(ownerId, new Map(safeEntries))
    }))

    await Promise.all(notes.value.map(async (note) => {
      const ownerMap = fileNameByOwner.get(note.uploaded_by || '')
      const fileName = ownerMap?.get(note.id)
      if (!fileName) {
        note.preview = 'Brak podglądu treści'
        return
      }

      const storagePath = `notes/${note.uploaded_by}/${fileName}`

      let text: string | null = null

      // Signed URL + no-store ogranicza zwracanie starej wersji po szybkim przejściu na kafelki.
      const { data: signedData, error: signedError } = await supabase.storage
        .from('files')
        .createSignedUrl(storagePath, 60)

      if (!signedError && signedData?.signedUrl) {
        try {
          const response = await fetch(signedData.signedUrl, { cache: 'no-store' })
          if (response.ok) {
            text = await response.text()
          }
        } catch (error) {
          console.error('Błąd pobierania podglądu przez signed URL:', error)
        }
      }

      if (text === null) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('files')
          .download(storagePath)

        if (downloadError || !fileData) {
          note.preview = 'Brak podglądu treści'
          return
        }

        text = await fileData.text()
      }

      const h1Title = extractFirstH1(text)
      if (h1Title) {
        note.title = h1Title
      }

      note.content = text
      note.preview = extractPreview(text)
    }))
  }

  const getNote = (id: string) => {
    return notes.value.find(n => n.id === id)
  }

  const addNote = async (title?: string) => {
    const currentUserId = await getCurrentUserId()

    if (!currentUserId) throw new Error("Brak autoryzacji (nie znaleziono w sesji Supabase)")

    const defaultTitle = title?.trim() || 'Nowa Notatka'
    const defaultContent = `# ${defaultTitle}\n\nZacznij pisać tutaj...`
    
    const fileBlob = new Blob([defaultContent], { type: 'text/markdown' })
    const storagePath = `notes/${currentUserId}/${Date.now()}.md`

    // Wrzucenie pliku-szablonu od razu do Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('files')
      .upload(storagePath, fileBlob, {
        contentType: 'text/markdown',
        cacheControl: '0'
      })

    if (storageError) {
      console.error('Błąd tworzenia notatki (Storage):', storageError)
      throw storageError
    }

    const objectId = (storageData as any)?.id
    if (!objectId) throw new Error("Brak objectId ze Storage")

    // Zapis do tabeli public.files (by widać było notatkę)
    const insertPayload: any = {
      object_id: objectId,
      uploaded_by: currentUserId,
      group_id: null,
      name: defaultTitle,
      size: fileBlob.size,
      mime_type: 'text/markdown',
      file_type: 'note'
    }

    const { data: dbData, error: dbError } = await supabase
      .from('files')
      .insert(insertPayload)
      .select()
      .single()

    if (dbError) {
      console.error('Błąd tworzenia notatki (DB):', dbError)
      throw dbError
    }

    // Dodanie do lokalnego stanu z ID wygenerowanym przez serwer
    notes.value.unshift({
      id: objectId,
      database_id: dbData.id,
      group_id: null,
      shared_group_id: null,
      uploaded_by: currentUserId,
      is_owner: true,
      visibility: 'personal',
      title: defaultTitle,
      content: defaultContent,
      preview: 'Zacznij pisać tutaj...',
      updated_at: dbData.created_at,
      color: 'emerald'
    })
    
    return objectId
  }

  const updateTitle = async (id: string, title: string) => {
    const safeTitle = title.trim() || 'Nowa Notatka'
    const note = getNote(id)
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji użytkownika.')

    if (note) {
      note.title = safeTitle
      note.updated_at = new Date().toISOString()
      note.content = syncFirstH1WithTitle(note.content || '', safeTitle)
      note.preview = extractPreview(note.content)
    }

    const { error: dbNameError } = await supabase
      .from('files')
      .update({ name: safeTitle })
      .eq('object_id', id)

    if (dbNameError) {
      throw dbNameError
    }

    const ownerUserId = note?.uploaded_by || currentUserId
    const storagePath = await resolveStoragePath(ownerUserId, id)
    if (!storagePath) {
      return
    }

    const sourceContent = note?.content || (await getNoteContent(id)) || ''
    const syncedContent = syncFirstH1WithTitle(sourceContent, safeTitle)
    const fileBlob = new Blob([syncedContent], { type: 'text/markdown' })

    const { error: storageError } = await supabase.storage
      .from('files')
      .update(storagePath, fileBlob, {
        contentType: 'text/markdown',
        cacheControl: '0',
        upsert: true
      })

    if (storageError) {
      throw storageError
    }

    const { error: dbMetaError } = await supabase
      .from('files')
      .update({
        name: safeTitle,
        size: fileBlob.size
      })
      .eq('object_id', id)

    if (dbMetaError) {
      throw dbMetaError
    }

    if (note) {
      note.content = syncedContent
      note.preview = extractPreview(syncedContent)
    }
  }

  const getNoteContent = async (objectId: string) => {
    if (!objectId) return null

    const currentUserId = await getCurrentUserId()
    if (!currentUserId) return null

    const note = getNote(objectId)
    const ownerUserId = note?.uploaded_by || currentUserId

    let path: string | null = null
    try {
      path = await resolveStoragePath(ownerUserId, objectId)
    } catch (error) {
      console.error('Blad listowania w poszukiwaniu ścieżki pliku', error)
      return null
    }

    if (!path) return null // Nie znalezlismy pliku

    // Używamy signed URL + no-store by wymusić świeżą treść po zapisie.
    const { data: signedData, error: signedError } = await supabase.storage
      .from('files')
      .createSignedUrl(path, 60)

    if (!signedError && signedData?.signedUrl) {
      try {
        const response = await fetch(signedData.signedUrl, { cache: 'no-store' })
        if (!response.ok) {
          console.error('Błąd pobierania signed URL markdowna:', response.status, response.statusText)
          return null
        }
        return await response.text()
      } catch (error) {
        console.error('Błąd fetch signed URL markdowna:', error)
        return null
      }
    }

    const { data, error } = await supabase.storage.from('files').download(path)
    
    if (error || !data) {
      console.error('Błąd pobierania Markdown z bucketu:', error)
      return null
    }
    
    return await data.text()
  }

  const saveNote = async (id: string, content: string, preferredTitle?: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error("Brak autoryzacji (nie znaleziono w sesji Supabase)")

    const note = getNote(id)
    if (!note) {
      throw new Error('Nie znaleziono notatki w lokalnym stanie. Odśwież listę notatek i spróbuj ponownie.')
    }

    const preferred = preferredTitle?.trim() || ''
    const h1Title = extractFirstH1(content) || ''
    const finalTitle = preferred || h1Title || note.title || 'Nowa Notatka'
    const syncedContent = syncFirstH1WithTitle(content, finalTitle)

    note.title = finalTitle
    note.content = syncedContent
    note.preview = extractPreview(syncedContent)
    note.updated_at = new Date().toISOString()

    const fileBlob = new Blob([syncedContent], { type: 'text/markdown' })

    const ownerUserId = note.uploaded_by || currentUserId
    const storagePath = await resolveStoragePath(ownerUserId, id)
    if (!storagePath) {
      throw new Error('Nie znaleziono pliku notatki w Storage. Odśwież listę notatek i spróbuj ponownie.')
    }

    const { error: storageError } = await supabase.storage
      .from('files')
      .update(storagePath, fileBlob, {
        contentType: 'text/markdown',
        cacheControl: '0',
        upsert: true
      })

    if (storageError) {
      console.error('Błąd wgrywania pliku:', storageError)
      throw storageError
    }

    const { error: dbError } = await supabase
      .from('files')
      .update({
        size: fileBlob.size,
        name: finalTitle
      })
      .eq('object_id', id)

    if (dbError) {
      console.error('Błąd aktualizacji metadanych notatki w DB:', dbError)
      throw dbError
    }

    return id
  }

  const deleteNote = async (id: string) => {
    const noteToDelete = getNote(id)
    if (!noteToDelete || id.startsWith('temp-')) {
      // Jeśli to tylko tymczasowa notatka z frontu, to wystarczy ją usunąć z tablicy
      notes.value = notes.value.filter(n => n.id !== id)
      return
    }

    if (!user.value) throw new Error("Wymagane logowanie")

    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji użytkownika.')

    if (noteToDelete.uploaded_by && noteToDelete.uploaded_by !== currentUserId) {
      throw new Error('Nie możesz usuwać notatki udostępnionej przez inną osobę.')
    }
    
    // Usuń z tabeli public.files
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('object_id', id)
      
    if (dbError) {
      console.error('Błąd usuwania notatki z bazy:', dbError)
      throw dbError
    }
    
    // Należy także usunąć plik ze storage bucketu (jeśli przechowujemy path lub objectId pasuje). 
    // W prawdziwym środowisku może do tego służyć Postgres Trigger na tabeli files lub osobne query.
    
    // Usuń w stanie aplikacji
    notes.value = notes.value.filter(n => n.id !== id)
  }

  const duplicateNote = async (id: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error("Brak autoryzacji.")

    const originalNote = getNote(id)
    if (!originalNote) throw new Error('Nie znaleziono notatki do skopiowania.')

    if (originalNote.uploaded_by && originalNote.uploaded_by !== currentUserId) {
      throw new Error('Nie możesz kopiować (duplikować) notatki, której nie jesteś autorem.')
    }

    const content = originalNote.content || (await getNoteContent(originalNote.id)) || ''
    const newTitle = `${originalNote.title} (Kopia)`
    const newContent = syncFirstH1WithTitle(content, newTitle)

    const fileBlob = new Blob([newContent], { type: 'text/markdown' })
    const storagePath = `notes/${currentUserId}/${Date.now()}.md`

    const { data: storageData, error: storageError } = await supabase.storage
      .from('files')
      .upload(storagePath, fileBlob, {
        contentType: 'text/markdown',
        cacheControl: '0'
      })

    if (storageError) {
      console.error('Błąd kopiowania notatki (Storage):', storageError)
      throw storageError
    }

    const objectId = (storageData as any)?.id
    if (!objectId) throw new Error("Brak objectId ze Storage")

    const insertPayload: any = {
      object_id: objectId,
      uploaded_by: currentUserId,
      group_id: null, // kopia zawsze trafia na prywatny profil
      name: newTitle,
      size: fileBlob.size,
      mime_type: 'text/markdown',
      file_type: 'note'
    }

    const { data: dbData, error: dbError } = await supabase
      .from('files')
      .insert(insertPayload)
      .select()
      .single()

    if (dbError) {
      console.error('Błąd tworzenia kopii notatki (DB):', dbError)
      throw dbError
    }

    notes.value.unshift({
      id: objectId,
      database_id: dbData.id,
      group_id: null,
      shared_group_id: null,
      uploaded_by: currentUserId,
      is_owner: true,
      visibility: 'personal',
      title: newTitle,
      content: newContent,
      preview: extractPreview(newContent),
      updated_at: dbData.created_at,
      color: originalNote.color || 'emerald'
    })

    return objectId
  }

  const setNoteVisibility = async (id: string, visibility: 'personal' | 'shared', targetGroupIdOverride?: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji użytkownika.')

    const note = getNote(id)
    if (!note) throw new Error('Nie znaleziono notatki.')

    if (note.uploaded_by && note.uploaded_by !== currentUserId) {
      throw new Error('Możesz zmieniać typ tylko własnych notatek.')
    }

    let targetGroupId: string | null = null
    if (visibility === 'shared') {
      if (targetGroupIdOverride) {
        targetGroupId = targetGroupIdOverride
      } else if (note.shared_group_id) {
        targetGroupId = note.shared_group_id
      } else {
        throw new Error('Brak wybranej grupy. Musisz wskazać grupę, której chcesz udostępnić notatkę.')
      }
    } else {
      if (note.group_id) {
        note.shared_group_id = note.group_id
      }
      targetGroupId = null
    }

    if (visibility === 'shared' && !targetGroupId) {
      throw new Error('Brak grupy współdzielonej. Nie można ustawić notatki współdzielonej.')
    }

    if (targetGroupId) {
      const membershipGroupIds = await getMembershipGroupIds(currentUserId)
      if (!membershipGroupIds.includes(targetGroupId)) {
        throw new Error('Nie należysz do wybranej grupy. Wybierz grupę, do której masz członkostwo.')
      }
    }

    const updatePayload = { group_id: targetGroupId }

    const { data: updatedData, error } = await supabase
      .from('files')
      .update(updatePayload as any)
      .eq('object_id', id)
      .select('id')

    if (error) {
      throw error
    }

    if (!updatedData || updatedData.length === 0) {
      throw new Error('Zapis odrzucony: brak uprawnień z powodu konfiguracji bazy danych (RLS).')
    }

    note.group_id = targetGroupId
    if (targetGroupId) {
      note.shared_group_id = targetGroupId
    }
    note.visibility = targetGroupId ? 'shared' : 'personal'
    note.updated_at = new Date().toISOString()
  }

  return {
    notes,
    fetchNotes,
    getNote,
    getNoteContent,
    addNote,
    updateTitle,
    saveNote,
    deleteNote,
    duplicateNote,
    getUserGroups,
    setNoteVisibility
  }
}