// Generate a simple random ID
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Sample restaurant data
const sampleRestaurants = [
  {
    id: generateId(),
    name: "Pizza Palace",
    description: "Delicious pizzas made with fresh ingredients",
    image_url: "https://placehold.co/400x300?text=Pizza+Palace",
    address: "123 Main St, City Center",
    phone: "+1-555-123-4567",
    email: "info@pizzapalace.com",
    rating: 4.5,
    delivery_fee: 3.99,
    min_order_amount: 15.00,
    estimated_delivery_time: 30,
    is_active: 1,
    is_available: 1,
    cuisine_type: "Italian",
    logo_url: "https://placehold.co/100x100?text=PP",
    cover_image_url: "https://placehold.co/800x400?text=Pizza+Palace+Cover",
    latitude: 40.7128,
    longitude: -74.0060,
    opening_time: "10:00:00",
    closing_time: "22:00:00",
    average_rating: 4.5,
    total_reviews: 120,
    contact_phone: "+1-555-123-4567",
    contact_email: "contact@pizzapalace.com",
    website_url: "https://www.pizzapalace.com",
    seating_capacity: 50,
    parking_availability: 1,
    delivery_radius: 5.0,
    minimum_order_value: 15.00,
    estimated_preparation_time: 20
  },
  {
    id: generateId(),
    name: "Burger Barn",
    description: "Juicy burgers and crispy fries",
    image_url: "https://placehold.co/400x300?text=Burger+Barn",
    address: "456 Oak Ave, Downtown",
    phone: "+1-555-987-6543",
    email: "hello@burgerbarn.com",
    rating: 4.2,
    delivery_fee: 2.99,
    min_order_amount: 12.00,
    estimated_delivery_time: 25,
    is_active: 1,
    is_available: 1,
    cuisine_type: "American",
    logo_url: "https://placehold.co/100x100?text=BB",
    cover_image_url: "https://placehold.co/800x400?text=Burger+Barn+Cover",
    latitude: 40.7589,
    longitude: -73.9851,
    opening_time: "11:00:00",
    closing_time: "23:00:00",
    average_rating: 4.2,
    total_reviews: 85,
    contact_phone: "+1-555-987-6543",
    contact_email: "contact@burgerbarn.com",
    website_url: "https://www.burgerbarn.com",
    seating_capacity: 40,
    parking_availability: 1,
    delivery_radius: 4.0,
    minimum_order_value: 12.00,
    estimated_preparation_time: 15
  },
  {
    id: generateId(),
    name: "Sushi Spot",
    description: "Fresh sushi and Japanese delicacies",
    image_url: "https://placehold.co/400x300?text=Sushi+Spot",
    address: "789 Pine Rd, East Side",
    phone: "+1-555-456-7890",
    email: "info@sushispot.com",
    rating: 4.7,
    delivery_fee: 4.99,
    min_order_amount: 25.00,
    estimated_delivery_time: 40,
    is_active: 1,
    is_available: 1,
    cuisine_type: "Japanese",
    logo_url: "https://placehold.co/100x100?text=SS",
    cover_image_url: "https://placehold.co/800x400?text=Sushi+Spot+Cover",
    latitude: 40.7505,
    longitude: -73.9934,
    opening_time: "12:00:00",
    closing_time: "21:00:00",
    average_rating: 4.7,
    total_reviews: 210,
    contact_phone: "+1-555-456-7890",
    contact_email: "contact@sushispot.com",
    website_url: "https://www.sushispot.com",
    seating_capacity: 30,
    parking_availability: 0,
    delivery_radius: 3.5,
    minimum_order_value: 25.00,
    estimated_preparation_time: 25
  }
];

// Sample menu categories
const sampleCategories = [
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[0].id, // Pizza Palace
    name: "Classic Pizzas",
    description: "Our traditional pizza selections",
    image_url: "https://placehold.co/200x150?text=Classic+Pizzas",
    sort_order: 1,
    is_active: 1
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[0].id, // Pizza Palace
    name: "Gourmet Pizzas",
    description: "Specialty pizzas with premium toppings",
    image_url: "https://placehold.co/200x150?text=Gourmet+Pizzas",
    sort_order: 2,
    is_active: 1
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[0].id, // Pizza Palace
    name: "Sides & Drinks",
    description: "Perfect accompaniments to your meal",
    image_url: "https://placehold.co/200x150?text=Sides+%26+Drinks",
    sort_order: 3,
    is_active: 1
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[1].id, // Burger Barn
    name: "Signature Burgers",
    description: "Our most popular burger creations",
    image_url: "https://placehold.co/200x150?text=Signature+Burgers",
    sort_order: 1,
    is_active: 1
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[1].id, // Burger Barn
    name: "Sides",
    description: "Complementary sides for your meal",
    image_url: "https://placehold.co/200x150?text=Sides",
    sort_order: 2,
    is_active: 1
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[2].id, // Sushi Spot
    name: "Nigiri & Sashimi",
    description: "Fresh fish served traditionally",
    image_url: "https://placehold.co/200x150?text=Nigiri+%26+Sashimi",
    sort_order: 1,
    is_active: 1
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[2].id, // Sushi Spot
    name: "Rolls",
    description: "Creative rolls with unique combinations",
    image_url: "https://placehold.co/200x150?text=Rolls",
    sort_order: 2,
    is_active: 1
  }
];

// Sample menu items
const sampleMenuItems = [
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[0].id, // Pizza Palace
    menu_category_id: sampleCategories[0].id, // Classic Pizzas
    name: "Margherita Pizza",
    description: "Tomato sauce, mozzarella, and fresh basil",
    price: 14.99,
    image_url: "https://placehold.co/300x200?text=Margherita+Pizza",
    is_available: 1,
    preparation_time: 15
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[0].id, // Pizza Palace
    menu_category_id: sampleCategories[0].id, // Classic Pizzas
    name: "Pepperoni Pizza",
    description: "Tomato sauce, mozzarella, and spicy pepperoni",
    price: 16.99,
    image_url: "https://placehold.co/300x200?text=Pepperoni+Pizza",
    is_available: 1,
    preparation_time: 15
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[0].id, // Pizza Palace
    menu_category_id: sampleCategories[1].id, // Gourmet Pizzas
    name: "Truffle Mushroom Pizza",
    description: "Wild mushrooms, truffle oil, and four cheese blend",
    price: 22.99,
    image_url: "https://placehold.co/300x200?text=Truffle+Pizza",
    is_available: 1,
    preparation_time: 20
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[0].id, // Pizza Palace
    menu_category_id: sampleCategories[2].id, // Sides & Drinks
    name: "Garlic Breadsticks",
    description: "Freshly baked breadsticks with garlic butter",
    price: 6.99,
    image_url: "https://placehold.co/300x200?text=Garlic+Bread",
    is_available: 1,
    preparation_time: 5
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[0].id, // Pizza Palace
    menu_category_id: sampleCategories[2].id, // Sides & Drinks
    name: "Caesar Salad",
    description: "Romaine lettuce, parmesan, croutons, and Caesar dressing",
    price: 8.99,
    image_url: "https://placehold.co/300x200?text=Caesar+Salad",
    is_available: 1,
    preparation_time: 5
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[1].id, // Burger Barn
    menu_category_id: sampleCategories[3].id, // Signature Burgers
    name: "Classic Cheeseburger",
    description: "Beef patty, cheddar cheese, lettuce, tomato, onion, pickles",
    price: 12.99,
    image_url: "https://placehold.co/300x200?text=Cheeseburger",
    is_available: 1,
    preparation_time: 10
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[1].id, // Burger Barn
    menu_category_id: sampleCategories[3].id, // Signature Burgers
    name: "Bacon Avocado Burger",
    description: "Beef patty, bacon, avocado, lettuce, tomato, special sauce",
    price: 15.99,
    image_url: "https://placehold.co/300x200?text=Bacon+Burger",
    is_available: 1,
    preparation_time: 12
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[1].id, // Burger Barn
    menu_category_id: sampleCategories[4].id, // Sides
    name: "Sweet Potato Fries",
    description: "Crispy sweet potato fries with chipotle mayo",
    price: 5.99,
    image_url: "https://placehold.co/300x200?text=Sweet+Fries",
    is_available: 1,
    preparation_time: 8
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[1].id, // Burger Barn
    menu_category_id: sampleCategories[4].id, // Sides
    name: "Onion Rings",
    description: "Golden beer-battered onion rings",
    price: 6.49,
    image_url: "https://placehold.co/300x200?text=Onion+Rings",
    is_available: 1,
    preparation_time: 8
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[2].id, // Sushi Spot
    menu_category_id: sampleCategories[5].id, // Nigiri & Sashimi
    name: "Salmon Nigiri",
    description: "Fresh salmon over seasoned rice",
    price: 4.99,
    image_url: "https://placehold.co/300x200?text=Salmon+Nigiri",
    is_available: 1,
    preparation_time: 3
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[2].id, // Sushi Spot
    menu_category_id: sampleCategories[5].id, // Nigiri & Sashimi
    name: "Tuna Sashimi",
    description: "Premium tuna cuts served with wasabi and soy sauce",
    price: 12.99,
    image_url: "https://placehold.co/300x200?text=Tuna+Sashimi",
    is_available: 1,
    preparation_time: 3
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[2].id, // Sushi Spot
    menu_category_id: sampleCategories[6].id, // Rolls
    name: "California Roll",
    description: "Crab, cucumber, avocado, and sesame seeds",
    price: 8.99,
    image_url: "https://placehold.co/300x200?text=Calif+Roll",
    is_available: 1,
    preparation_time: 5
  },
  {
    id: generateId(),
    restaurant_id: sampleRestaurants[2].id, // Sushi Spot
    menu_category_id: sampleCategories[6].id, // Rolls
    name: "Dragon Roll",
    description: "Eel, cucumber, avocado topped with eel sauce",
    price: 14.99,
    image_url: "https://placehold.co/300x200?text=Dragon+Roll",
    is_available: 1,
    preparation_time: 7
  }
];

/**
 * Seed the database with sample data
 */
export async function seedDatabase(getDatabaseFunc) {
  // console.log('Seeding database with sample data...');
  
  // Get the database instance
  let db;
  try {
    db = getDatabaseFunc();
    if (!db) {
      throw new Error('Database instance not available');
    }
  } catch (error) {
    // console.error('Error getting database instance:', error);
    return false;
  }

  try {
    // Check if the database supports transactions by checking if the method exists
    const hasTransactionSupport = typeof db.withTransactionAsync === 'function';
    
    if (hasTransactionSupport) {
      // Real database - use transaction
      await db.withTransactionAsync(async () => {
        // Clear existing data
        await db.execAsync(`
          DELETE FROM menu_items;
          DELETE FROM menu_categories;
          DELETE FROM restaurants;
        `);

        // console.log('Cleared existing restaurant, category, and menu item data');

        // Insert sample restaurants
        for (const restaurant of sampleRestaurants) {
          await db.runAsync(
            `INSERT INTO restaurants (
              id, owner_id, name, description, image_url, address, phone, email, 
              cuisine_type, rating, delivery_fee, min_order_amount, estimated_delivery_time, 
              is_active, is_available, logo_url, cover_image_url, created_at, updated_at, 
              latitude, longitude, coordinates_geocoded, opening_time, closing_time, 
              average_rating, total_reviews, contact_phone, contact_email, website_url, 
              seating_capacity, parking_availability, delivery_radius, minimum_order_value, 
              estimated_preparation_time, last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 
            ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              restaurant.id, restaurant.owner_id || null, restaurant.name, restaurant.description, 
              restaurant.image_url, restaurant.address, restaurant.phone, restaurant.email, 
              restaurant.cuisine_type, restaurant.rating, restaurant.delivery_fee, 
              restaurant.min_order_amount, restaurant.estimated_delivery_time, 
              restaurant.is_active, restaurant.is_available, restaurant.logo_url, 
              restaurant.cover_image_url, restaurant.latitude, restaurant.longitude, 
              restaurant.opening_time, restaurant.closing_time, restaurant.average_rating, 
              restaurant.total_reviews, restaurant.contact_phone, restaurant.contact_email, 
              restaurant.website_url, restaurant.seating_capacity, restaurant.parking_availability, 
              restaurant.delivery_radius, restaurant.minimum_order_value, restaurant.estimated_preparation_time
            ]
          );
        }

        // console.log(`Inserted ${sampleRestaurants.length} restaurants`);

        // Insert sample categories
        for (const category of sampleCategories) {
          await db.runAsync(
            `INSERT INTO menu_categories (
              id, restaurant_id, name, description, image_url, sort_order, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
              category.id, category.restaurant_id, category.name, category.description, 
              category.image_url, category.sort_order, category.is_active
            ]
          );
        }

        // console.log(`Inserted ${sampleCategories.length} menu categories`);

        // Insert sample menu items
        for (const item of sampleMenuItems) {
          await db.runAsync(
            `INSERT INTO menu_items (
              id, restaurant_id, menu_category_id, name, description, price, image_url, 
              is_available, preparation_time, dietary_restrictions, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
              item.id, item.restaurant_id, item.menu_category_id, item.name, 
              item.description, item.price, item.image_url, item.is_available, 
              item.preparation_time, null // dietary_restrictions
            ]
          );
        }

        // console.log(`Inserted ${sampleMenuItems.length} menu items`);
      });
    } else {
      // Mock database - perform operations without transaction
      // Clear existing data
      await db.execAsync(`
        DELETE FROM menu_items;
        DELETE FROM menu_categories;
        DELETE FROM restaurants;
      `);

      // console.log('Cleared existing restaurant, category, and menu item data (mock db)');

      // Insert sample restaurants
      for (const restaurant of sampleRestaurants) {
        await db.runAsync(
          `INSERT INTO restaurants (
            id, owner_id, name, description, image_url, address, phone, email, 
            cuisine_type, rating, delivery_fee, min_order_amount, estimated_delivery_time, 
            is_active, is_available, logo_url, cover_image_url, created_at, updated_at, 
            latitude, longitude, coordinates_geocoded, opening_time, closing_time, 
            average_rating, total_reviews, contact_phone, contact_email, website_url, 
            seating_capacity, parking_availability, delivery_radius, minimum_order_value, 
            estimated_preparation_time, last_updated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 
          ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            restaurant.id, restaurant.owner_id || null, restaurant.name, restaurant.description, 
            restaurant.image_url, restaurant.address, restaurant.phone, restaurant.email, 
            restaurant.cuisine_type, restaurant.rating, restaurant.delivery_fee, 
            restaurant.min_order_amount, restaurant.estimated_delivery_time, 
            restaurant.is_active, restaurant.is_available, restaurant.logo_url, 
            restaurant.cover_image_url, restaurant.latitude, restaurant.longitude, 
            restaurant.opening_time, restaurant.closing_time, restaurant.average_rating, 
            restaurant.total_reviews, restaurant.contact_phone, restaurant.contact_email, 
            restaurant.website_url, restaurant.seating_capacity, restaurant.parking_availability, 
            restaurant.delivery_radius, restaurant.minimum_order_value, restaurant.estimated_preparation_time
          ]
        );
      }

      // console.log(`Inserted ${sampleRestaurants.length} restaurants (mock db)`);

      // Insert sample categories
      for (const category of sampleCategories) {
        await db.runAsync(
          `INSERT INTO menu_categories (
            id, restaurant_id, name, description, image_url, sort_order, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            category.id, category.restaurant_id, category.name, category.description, 
            category.image_url, category.sort_order, category.is_active
          ]
        );
      }

      // console.log(`Inserted ${sampleCategories.length} menu categories (mock db)`);

      // Insert sample menu items
      for (const item of sampleMenuItems) {
        await db.runAsync(
          `INSERT INTO menu_items (
            id, restaurant_id, menu_category_id, name, description, price, image_url, 
            is_available, preparation_time, dietary_restrictions, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            item.id, item.restaurant_id, item.menu_category_id, item.name, 
            item.description, item.price, item.image_url, item.is_available, 
            item.preparation_time, null // dietary_restrictions
          ]
        );
      }

      // console.log(`Inserted ${sampleMenuItems.length} menu items (mock db)`);
    }

    // console.log('Database seeding completed successfully!');
    return true;
  } catch (error) {
    // console.error('Error seeding database:', error);
    return false;
  }
}

// Export the sample data for use in other contexts if needed
export { sampleRestaurants, sampleCategories, sampleMenuItems };