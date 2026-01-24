import { useTheme } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
//import { USER_COLORS } from '@/app/components/AppScreen';

// const USER_COLORS = [
//   '#60a5fa',     // blue-400
//   '#f87171',     // red-400
//   '#4ade80',     // green-400
//   '#fbbf24',     // yellow-400
//   '#a78bfa',     // purple-400
//   '#f472b6',     // pink-400
//   '#818cf8',     // indigo-400
//   '#fb923c',     // orange-400
//   '#2dd4bf',     // teal-400
//   '#22d3ee',     // cyan-400
// ];


interface NativeThemeColorType {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
}


export interface ReceiptItemType {
    id: string;
    name: string;
    price: string;
    userTags?: number[]; // Array of user indices that have this item in their basket
    discount?: string; // Optional discount amount
}

interface ReceiptItemProps {
    item: {
        id: string;
        name: string;
        price: string;
        userTags?: number[];
        discount?: string;
    };
    index: number;
    onUpdate: (updates: { name?: string; price?: string; discount?: string }) => void;
    onDelete: () => void;
    onRemoveFromUser: (userIndex: number) => void;
}

export function ReceiptItem({
    item,
    index,
    onUpdate,
    onDelete,
    onRemoveFromUser,
}: ReceiptItemProps) {
    const { colors, dark } = useTheme();
    const styles = useMemo(() => createStyles(colors, dark), [colors, dark]);
    const [showDiscount, setShowDiscount] = useState(!!item.discount && parseFloat(item.discount) > 0);
    const [isHovering, setIsHovering] = useState(false);
    //const [canDrag, setCanDrag] = useState(false);
    //const [newlyAddedTags, setNewlyAddedTags] = useState<Set<number>>(new Set());

    // Sort user tags in increasing order
    //const sortedUserTags = item.userTags ? [...item.userTags].sort((a, b) => a - b) : [];

    const handlePriceChange = (value: string) => {
        const numericValue = value.replace(/[^\d.]/g, '');
        if (onUpdate) {
            onUpdate({ price: numericValue });
        }
    };

    const handleDiscountChange = (value: string) => {
        const numericValue = value.replace(/[^\d.]/g, '');
        if (onUpdate) {
            onUpdate({ discount: numericValue });
        }
    };

    const handleDiscountBlur = () => {
        const discountValue = parseFloat(item.discount || '0');
        if (discountValue <= 0 || !item.discount) {
            setShowDiscount(false);
            if (onUpdate) {
                onUpdate({ discount: undefined });
            }
        }
    };

    return (
        <Pressable
            style={[styles.container, isHovering && styles.containerHover]}
            onHoverIn={() => setIsHovering(true)}
            onHoverOut={() => setIsHovering(false)}
            onPressIn={() => setIsHovering(true)}
            onPressOut={() => setIsHovering(false)}
        >
            <View style={styles.header}>
                <View style={styles.leftSection}>
                    {(
                        <Pressable
                            onPress={() => {
                                if (onDelete) onDelete();
                            }}
                            style={styles.deleteButton}
                            accessibilityLabel="Delete item"
                        >
                            {
                                <Text style={styles.deleteIcon}>✕</Text>
                            }
                        </Pressable>
                    )}
                    <View style={styles.nameContainer}>
                        {(
                            <TextInput
                                value={item.name}
                                onChangeText={(text) => onUpdate({ name: text })}
                                placeholder="Item name"
                                style={styles.nameInput}
                            />
                        )}
                    </View>
                </View>

                <View style={styles.rightSection}>
                    {/* Price */}
                    <View style={styles.priceContainer}>
                        {(
                            <View style={styles.priceInputContainer}>
                                <Text style={styles.dollarSign}>$</Text>
                                <TextInput
                                    value={item.price}
                                    onChangeText={handlePriceChange}
                                    placeholder="0.00"
                                    style={styles.priceInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}
                    </View>

                    {/* Discount section - right justified */}
                    {showDiscount ? (
                        <View style={styles.discountContainer}>
                            <Text style={styles.discountLabel}>Discount:</Text>
                            <Text style={styles.discountDollar}>$</Text>
                            <TextInput
                                value={item.discount || ''}
                                onChangeText={handleDiscountChange}
                                onBlur={handleDiscountBlur}
                                placeholder="0.00"
                                style={styles.discountInput}
                                keyboardType="numeric"
                            />
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => {
                                setShowDiscount(true);
                            }}
                            style={styles.addDiscountButton}
                            accessibilityLabel="Add discount"
                        >
                            <Text style={styles.addDiscountText}>+ Discount</Text>
                        </TouchableOpacity>
                    )
                    }
                </View>
            </View>

            {/* User tags - positioned at bottom extending below box */}
            {/* {sortedUserTags.length > 0 && (
                <View style={styles.userTagsContainer}>
                    {sortedUserTags.map((userIndex) => {
                        const color = USER_COLORS[(userIndex - 1) % USER_COLORS.length];
                        const isNewlyAdded = newlyAddedTags.has(userIndex) && (item.userTags?.includes(userIndex)??false);
                        return (
                            <UserTag
                                key={userIndex}
                                userIndex={userIndex}
                                color={color}
                                onRemove={() => onRemoveFromUser && onRemoveFromUser(userIndex)}
                                isNewlyAdded={isNewlyAdded}
                            />
                        );
                    })}
                </View>
            )} */}
        </Pressable>
    );
}

// Separate component for user tags with hover state
// function UserTag({
//     userIndex,
//     color,
//     onRemove,
//     isNewlyAdded
// }: {
//     userIndex: number;
//     color: string;
//     onRemove: () => void;
//     isNewlyAdded: boolean;
// }) {
//     const [isHovering, setIsHovering] = useState(false);

//     return (
//         <Pressable
//             onPress={() => {
//                 onRemove();
//             }}
//             onHoverIn={() => setIsHovering(true)}
//             onHoverOut={() => setIsHovering(false)}
//             onPressIn={() => setIsHovering(true)}
//             onPressOut={() => setIsHovering(false)}
//             style={[styles.userTag, { backgroundColor: color }, isNewlyAdded && styles.userTagNew]}
//             accessibilityLabel={`Remove from user ${userIndex}`}
//         >
//             {isHovering ? (
//                 <Text style={styles.userTagRemove}>✕</Text>
//             ) : (
//                 <Text style={styles.userTagText}>{userIndex}</Text>
//             )}
//         </Pressable>
//     );
// }


const createStyles = (colors: NativeThemeColorType, dark: boolean) =>
    StyleSheet.create({
        container: {
            minWidth: '100%',
            backgroundColor: colors.card,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            paddingLeft: 24,
            paddingRight: 24,
            paddingBottom: 24,
            marginBottom: 8,
        },
        containerHover: {
            transform: [{ scale: 1.03 }],
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 8,
        },
        leftSection: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            flex: 1,
            minWidth: 0,
        },
        deleteButton: {
            minWidth: 24,
            alignItems: 'center',
            marginTop: 4,
        },
        deleteIcon: {
            color: dark ? '#873030' : '#d42e2e',
            fontSize: 20,
            fontWeight: 'bold',
        },
        gripIcon: {
            color: colors.text,
            fontSize: 20,
        },
        // splitBadge: {
        //     backgroundColor: '#e5e7eb',
        //     paddingHorizontal: 8,
        //     paddingVertical: 4,
        //     borderRadius: 4,
        //     marginTop: 4,
        // },
        // splitText: {
        //     color: '#374151',
        //     fontSize: 12,
        //     fontWeight: 'bold',
        // },
        nameContainer: {
            flex: 1,
            minWidth: 0,
        },
        nameInput: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 4,
            padding: 8,
            color: colors.text,
        },
        nameText: {
            color: colors.text,
        },
        rightSection: {
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
        },
        priceContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        priceInputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        dollarSign: {
            color: colors.text,
            fontWeight: 'bold',
        },
        priceInput: {
            width: 80,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 4,
            padding: 8,
            color: colors.text,
            fontWeight: 'bold',
            textAlign: 'right',
        },
        priceText: {
            color: colors.text,
            fontWeight: 'bold',
        },
        discountContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 4,
        },
        discountLabel: {
            fontSize: 12,
            color: colors.text,
        },
        discountDollar: {
            color: colors.text,
            fontSize: 14,
        },
        discountInput: {
            width: 64,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 4,
            padding: 8,
            color: colors.text,
            fontSize: 14,
            textAlign: 'right',
        },
        addDiscountButton: {
            minWidth: 130,
            flexDirection: 'row',
            gap: 4,
            padding: 8,
            borderRadius: 4,
            alignSelf: 'flex-end',
            marginLeft: 'auto',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
        },
        addDiscountText: {
            fontSize: 12,
            color: '#2563eb',
        },
        userTagsContainer: {
            position: 'absolute',
            bottom: -12,
            left: 16,
            right: 16,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            zIndex: 10,
        },
        userTag: {
            width: 40,
            height: 40,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        userTagNew: {
            transform: [{ scale: 1.1 }],
        },
        userTagRemove: {
            color: colors.text,
            fontSize: 16,
            fontWeight: 'bold',
        },
        userTagText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: 'bold',
        },
    });