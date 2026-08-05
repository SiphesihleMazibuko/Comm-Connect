import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { triggerPressFeedback } from '../Utils/pressFeedback';

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        triggerPressFeedback();
        props.onPressIn?.(ev);
      }}
    />
  );
}
