import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions } from 'react-native';

interface Category {
  id: string;
  name: string;
}

interface CategorySelectorProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}) => {
  // Add an "All" option to show all items
  const allCategories = [{ id: 'all', name: 'All' }, ...categories];

  const renderCategory = ({ item }: { item: Category }) => {
    const isSelected = selectedCategory === item.id || (item.id === 'all' && selectedCategory === null);
    
    return (
      <TouchableOpacity
        style={[
          styles.categoryButton,
          isSelected && styles.selectedCategoryButton
        ]}
        onPress={() => onSelectCategory(item.id === 'all' ? null : item.id)}
      >
        <Text
          style={[
            styles.categoryText,
            isSelected && styles.selectedCategoryText
          ]}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={allCategories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={Dimensions.get('window').width * 0.3} // Snap to approximate item width
        decelerationRate="fast"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    minWidth: 80,
    alignItems: 'center',
  },
  selectedCategoryButton: {
    backgroundColor: '#C41E26',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  selectedCategoryText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default CategorySelector;