import TouchableOpacity from './FeedbackTouchableOpacity';
import { Text, ActivityIndicator, Animated } from 'react-native';
import { useState, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../Utils/colors';

export default function DramaticButton({ 
  title, 
  onPress, 
  loading, 
  variant = 'primary',
  icon,
  style 
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isHovered, setIsHovered] = useState(false);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
    onPress();
  };

  const gradients = {
    primary: [colors.gradient1, colors.gradient2],
    secondary: [colors.gradient2, colors.gradient3],
    danger: ['#3a506b', '#0b132b'],
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], ...style }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        activeOpacity={1}
      >
        <LinearGradient
          colors={gradients[variant] || gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderRadius: 50,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 10,
            shadowColor: colors.glow,
            shadowOffset: { width: 0, height: isHovered ? 8 : 4 },
            shadowOpacity: isHovered ? 0.5 : 0.3,
            shadowRadius: isHovered ? 20 : 12,
            elevation: isHovered ? 8 : 5,
            transform: [{ translateY: isHovered ? -2 : 0 }],
          }}
        >
          {icon && icon}
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              {title}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}
