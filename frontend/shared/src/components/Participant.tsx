import { USER_COLORS } from '@shared/constants';
import { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  LayoutRectangle,
  Pressable,
  TouchableOpacity,
} from 'react-native';

interface ParticipantsProps {
  id: number;
  changeName: (text: string) => void;
  onRemove: () => void;
  onLayout: (event: LayoutRectangle) => void;
  goToYourItemsPage: () => void;
  onClickTextIn: () => void;
  onClickTextOut: () => void;
}

export function Participant({
  id,
  changeName,
  onRemove,
  onLayout,
  goToYourItemsPage,
  onClickTextIn,
  onClickTextOut,
}: ParticipantsProps) {
  const ref = useRef<View>(null);

  return (
    <Pressable
      ref={ref}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onLayout({ x, y, width, height });
        });
      }}
      className={`bg-${USER_COLORS[(id - 1) % USER_COLORS.length]} border border-border rounded-[10px] h-[100px] min-w-[100px] p-5 items-center justify-center relative`}
      onPress={goToYourItemsPage}
    >
      <TouchableOpacity
        className='absolute bg-destructive w-6 h-6 rounded-[10px] items-center justify-center border-2 border-background z-10'
        style={{ top: -7, left: -7 }}
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, right: 10, left: 10 }}
      >
        <Text
          className='text-background text-[17px] font-bold'
          style={{ top: -2 }}
        >
          x
        </Text>
      </TouchableOpacity>
      <TextInput
        placeholder={'Name ' + id}
        onChangeText={changeName}
        className='text-foreground font-bold'
        style={{ top: -5 }}
        onFocus={onClickTextIn}
        onBlur={onClickTextOut}
      />
    </Pressable>
  );
}
