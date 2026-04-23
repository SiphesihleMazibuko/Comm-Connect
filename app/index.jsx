import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import colors from '../Utils/colors';

export default function SplashScreen() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    //Navigate after animation
    const timer = setTimeout(() => {
      router.replace('/login'); // change if needed
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        alignItems: 'center'
      }}>
        <View style={{
          width: 120,
          height: 120,
          backgroundColor: colors.accent,
          borderRadius: 60,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 20
        }}>
          <Text style={{ fontSize: 50 }}>🤝</Text>
        </View>

        <Text style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: '#fff',
          marginBottom: 8
        }}>
          Comm-Connect
        </Text>

        <Text style={{
          fontSize: 16,
          color: colors.accent,
          textAlign: 'center'
        }}>
          Your Community, Connected
        </Text>

        <Text style={{
          fontSize: 14,
          color: '#fff',
          marginTop: 20,
          opacity: 0.7,
          textAlign: 'center'
        }}>
          Connecting communities • PinPoint addresses • Emergency alerts
        </Text>
      </Animated.View>
    </View>
  );
}