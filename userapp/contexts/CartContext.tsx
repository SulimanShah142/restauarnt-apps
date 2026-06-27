import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Define types
export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  restaurantId: string;
}

export interface CartItem {
  id: string;
  foodItem: FoodItem;
  quantity: number;
  restaurantId: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART'; payload: { restaurantId: string } }
  | { type: 'SET_CART'; payload: CartItem[] };

// Create context
interface CartContextType {
  state: CartState;
  cart: CartItem[];
  dispatch: React.Dispatch<CartAction>;
  addItem: (item: CartItem) => boolean;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: (restaurantId: string) => void;
  getTotalPrice: () => number;
  getItemCount: () => number;
  getCartRestaurantId: () => string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Reducer
const cartReducer = (state: CartState, action: CartAction): CartState => {
  console.log('[CartReducer] Action:', action.type, 'payload:', action.payload);
  
  switch (action.type) {
    case 'ADD_ITEM':
      const existingItem = state.items.find(item => item.id === action.payload.id);
      if (existingItem) {
        console.log('[CartReducer] Updating existing item quantity');
        return {
          ...state,
          items: state.items.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          ),
        };
      }
      console.log('[CartReducer] Adding new item to cart');
      return {
        ...state,
        items: [...state.items, action.payload],
      };
    case 'REMOVE_ITEM':
      console.log('[CartReducer] Removing item:', action.payload.id);
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload.id),
      };
    case 'UPDATE_QUANTITY':
      console.log('[CartReducer] Updating quantity for item:', action.payload.id, 'to:', action.payload.quantity);
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(0, action.payload.quantity) }
            : item
        ).filter(item => item.quantity > 0), // Remove items with 0 quantity
      };
    case 'CLEAR_CART':
      console.log('[CartReducer] Clearing cart for restaurant:', action.payload.restaurantId);
      return {
        ...state,
        items: state.items.filter(item => item.restaurantId !== action.payload.restaurantId),
      };
    case 'SET_CART':
      console.log('[CartReducer] Setting cart with', action.payload.length, 'items');
      return {
        ...state,
        items: action.payload,
      };
    default:
      console.log('[CartReducer] Unknown action:', action);
      return state; // This ensures we always return a valid state
  }
};

// Provider component
interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  console.log('[CartProvider] Render - items count:', state.items.length);

  const addItem = (item: CartItem): boolean => {
    console.log('[CartProvider] addItem:', item.foodItem.name, 'restaurantId:', item.restaurantId);

    // Check if cart already has items from a different restaurant
    const existingRestaurantId = state.items.length > 0 ? state.items[0]?.restaurantId : null;

    if (existingRestaurantId && existingRestaurantId !== item.restaurantId) {
      console.log('[CartProvider] ❌ Restaurant mismatch! Cart has items from', existingRestaurantId, 'but trying to add from', item.restaurantId);
      return false; // Reject the add
    }

    dispatch({ type: 'ADD_ITEM', payload: item });
    return true;
  };

  const getCartRestaurantId = (): string | null => {
    return state.items.length > 0 ? state.items[0]?.restaurantId : null;
  };

  const removeItem = (id: string) => {
    console.log('[CartProvider] removeItem:', id);
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };

  const updateQuantity = (id: string, quantity: number) => {
    console.log('[CartProvider] updateQuantity:', id, quantity);
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };

  const clearCart = (restaurantId: string) => {
    console.log('[CartProvider] clearCart for restaurant:', restaurantId);
    dispatch({ type: 'CLEAR_CART', payload: { restaurantId } });
  };

  const getTotalPrice = (): number => {
    const total = state.items.reduce((total, item) => total + item.foodItem.price * item.quantity, 0);
    console.log('[CartProvider] getTotalPrice:', total);
    return total;
  };

  const getItemCount = (): number => {
    const count = state.items.reduce((count, item) => count + item.quantity, 0);
    console.log('[CartProvider] getItemCount:', count);
    return count;
  };

  const value: CartContextType = Object.freeze({
    state,
    cart: state.items, // Expose cart items directly
    dispatch,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getItemCount,
    getCartRestaurantId,
  });

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

// Custom hook
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    // Return safe defaults instead of throwing
    console.warn('[useCart] Used outside CartProvider, returning defaults');
    return {
      state: { items: [] },
      cart: [],
      dispatch: () => {},
      addItem: () => false,
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      getTotalPrice: () => 0,
      getItemCount: () => 0,
      getCartRestaurantId: () => null,
    };
  }
  console.log('[useCart] Returning cart context');
  return context;
};