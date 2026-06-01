import { useState, useMemo, useCallback } from 'react'
import { menu, allItems } from '../data/menu.js'

export function useMenu() {
  const [selectedCategory, setSelectedCategory] = useState(null) // null = all
  const [searchQuery, setSearchQuery]           = useState('')

  const categories = useMemo(() =>
    menu.map(c => ({ category: c.category, categoryZh: c.categoryZh })),
    []
  )

  // Items shown in the centre panel (filtered by category or search)
  const displayedItems = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      return allItems.filter(item =>
        item.nameEn.toLowerCase().includes(q) ||
        (item.nameZh && item.nameZh.includes(searchQuery.trim())) ||
        item.category.toLowerCase().includes(q) ||
        item.categoryZh.includes(searchQuery.trim())
      )
    }
    if (selectedCategory) {
      const cat = menu.find(c => c.category === selectedCategory)
      return cat ? cat.items.map(item => ({
        ...item,
        category: cat.category,
        categoryZh: cat.categoryZh,
      })) : []
    }
    return allItems
  }, [searchQuery, selectedCategory])

  // Active category title for centre panel header
  const activeCategoryTitle = useMemo(() => {
    if (searchQuery.trim()) return null
    if (!selectedCategory) return null
    const cat = menu.find(c => c.category === selectedCategory)
    return cat ? { en: cat.category, zh: cat.categoryZh } : null
  }, [searchQuery, selectedCategory])

  // Autocomplete suggestions (max 8, only when typing)
  const suggestions = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return []
    const lower = q.toLowerCase()
    return allItems
      .filter(item =>
        item.nameEn.toLowerCase().includes(lower) ||
        (item.nameZh && item.nameZh.includes(q)) ||
        item.category.toLowerCase().includes(lower) ||
        item.categoryZh.includes(q)
      )
      .slice(0, 8)
  }, [searchQuery])

  const selectCategory = useCallback((cat) => {
    setSelectedCategory(cat)
    setSearchQuery('')
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  return {
    menu,
    categories,
    allItems,
    displayedItems,
    activeCategoryTitle,
    suggestions,
    selectedCategory,
    searchQuery,
    setSearchQuery,
    selectCategory,
    clearSearch,
  }
}
