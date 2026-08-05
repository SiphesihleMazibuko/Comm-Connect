import { forwardRef } from 'react';
import { TouchableOpacity as NativeTouchableOpacity } from 'react-native';
import { triggerPressFeedback } from '../Utils/pressFeedback';

const FeedbackTouchableOpacity = forwardRef(({ disabled, onPressIn, ...props }, ref) => (
  <NativeTouchableOpacity
    ref={ref}
    disabled={disabled}
    onPressIn={(event) => {
      if (!disabled) {
        triggerPressFeedback();
      }
      onPressIn?.(event);
    }}
    {...props}
  />
));

FeedbackTouchableOpacity.displayName = 'FeedbackTouchableOpacity';

export default FeedbackTouchableOpacity;
