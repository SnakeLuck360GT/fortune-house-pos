import { useReducer, useCallback, useMemo } from 'react'

function orderReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.id === action.item.id)
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.id === action.item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }
      }
      return {
        ...state,
        items: [...state.items, { ...action.item, quantity: 1, note: action.item.note ?? '' }],
      }
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.id) }
    case 'INCREMENT':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      }
    case 'DECREMENT':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.id && i.quantity > 1
            ? { ...i, quantity: i.quantity - 1 }
            : i
        ),
      }
    case 'SET_NOTE':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.id
            ? { ...i, note: action.note, notePrice: action.notePrice != null ? action.notePrice : (i.notePrice || 0) }
            : i
        ),
      }
    case 'SPLIT_ITEM': {
      const target = state.items.find(i => i.id === action.id)
      if (!target || target.quantity <= 1) return state
      return {
        ...state,
        items: [
          ...state.items.map(i =>
            i.id === action.id ? { ...i, quantity: i.quantity - 1 } : i
          ),
          { ...target, id: `${target.id}_${Date.now()}`, quantity: 1, note: '' },
        ],
      }
    }
    case 'SET_DISCOUNT':
      return { ...state, discount: action.discount }
    case 'SET_DELIVERY_FEE':
      return { ...state, deliveryFee: action.fee }
    case 'CLEAR':
      return { ...initialState }
    default:
      return state
  }
}

const initialState = { items: [], discount: 0, deliveryFee: 0 }

export function useOrder() {
  const [state, dispatch] = useReducer(orderReducer, initialState)

  const addItem = useCallback((item) => dispatch({ type: 'ADD_ITEM', item }), [])
  const removeItem = useCallback((id) => dispatch({ type: 'REMOVE_ITEM', id }), [])
  const increment = useCallback((id) => dispatch({ type: 'INCREMENT', id }), [])
  const decrement = useCallback((id) => dispatch({ type: 'DECREMENT', id }), [])
  const setNote = useCallback((id, note, notePrice) => dispatch({ type: 'SET_NOTE', id, note, notePrice }), [])
  const splitItem = useCallback((id) => dispatch({ type: 'SPLIT_ITEM', id }), [])
  const setDiscount    = useCallback((d) => dispatch({ type: 'SET_DISCOUNT',     discount:    Number(d) || 0 }), [])
  const setDeliveryFee = useCallback((f) => dispatch({ type: 'SET_DELIVERY_FEE', fee:         Number(f) || 0 }), [])
  const clearOrder = useCallback(() => dispatch({ type: 'CLEAR' }), [])

  const subtotal = useMemo(
    () => state.items.reduce((sum, i) => sum + (i.price + (i.notePrice || 0)) * i.quantity, 0),
    [state.items]
  )

  const total = useMemo(
    () => Math.max(0, subtotal - (state.discount || 0) + (state.deliveryFee || 0)),
    [subtotal, state.discount, state.deliveryFee]
  )

  const itemCount = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items]
  )

  const getQuantityInOrder = useCallback(
    (id) => state.items
      .filter(i => i.id === id || i.id.startsWith(id + '_'))
      .reduce((sum, i) => sum + i.quantity, 0),
    [state.items]
  )

  return {
    items:       state.items,
    discount:    state.discount,
    deliveryFee: state.deliveryFee,
    subtotal,
    total,
    itemCount,
    addItem,
    removeItem,
    increment,
    decrement,
    setNote,
    splitItem,
    setDiscount,
    setDeliveryFee,
    clearOrder,
    getQuantityInOrder,
  }
}
