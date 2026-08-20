import React, { forwardRef } from 'react';
import { TouchableOpacity as NativeTouchableOpacity } from 'react-native';
import { triggerPressFeedback } from '../Utils/pressFeedback';

const FeedbackTouchableOpacity = forwardRef(
  ({ disabled, onPressIn, ...props }, ref) => {
    return (
      <NativeTouchableOpacity
        ref={ref}
        disabled={disabled}
        {...props}
        onPressIn={(event) => {
          if (!disabled) {
            triggerPressFeedback();
          }

          if (onPressIn) {
            onPressIn(event);
          }
        }}
      />
    );
  }
);

FeedbackTouchableOpacity.displayName = 'FeedbackTouchableOpacity';

export default FeedbackTouchableOpacity;