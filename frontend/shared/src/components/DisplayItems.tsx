import { Pressable, Text, View } from 'react-native';

export interface DisplayClaimedReceiptItemProps {
  name: string;
  price: string;
  discount?: string;
  percentage?: number;
  onRemove?: () => void;
}

export function DisplayItems({
  name,
  price,
  discount,
  percentage,
  onRemove,
}: DisplayClaimedReceiptItemProps) {
  const showDiscount = !!discount && parseFloat(discount) > 0;
  const pct = Math.round(percentage ?? 100);

  return (
    <View className='w-full bg-card rounded-2xl p-4'>
      <View className='flex-row items-center'>
        {/* Remove button — only rendered when a handler is provided */}
        {onRemove !== undefined ? (
          <Pressable
            onPress={onRemove}
            className='w-10 h-10 items-center justify-center'
            accessibilityLabel='Remove item'
          >
            <Text className='text-destructive text-2xl font-bold'>✕</Text>
          </Pressable>
        ) : (
          <View className='w-10 h-10' />
        )}

        {/* Percentage badge */}
        {pct < 100 && (
          <View className='bg-surface-elevated rounded-md px-2 py-1 items-center justify-center mr-2'>
            <Text className='text-xs font-bold text-foreground'>{pct}%</Text>
          </View>
        )}

        {/* Name */}
        <Text
          className='text-foreground font-extrabold text-xl flex-1 mr-2'
          numberOfLines={1}
        >
          {name || 'Unnamed Item'}
        </Text>

        {/* Price */}
        <Text className='text-foreground font-extrabold text-xl'>
          ${parseFloat(price || '0').toFixed(2)}
        </Text>
      </View>

      {/* Discount row */}
      {showDiscount && (
        <View className='flex-row items-center justify-end gap-1 mt-1'>
          <Text className='text-xs text-muted-foreground'>Discount:</Text>
          <Text className='text-sm text-foreground'>
            ${parseFloat(discount!).toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}
