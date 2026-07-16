import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';

interface SessionWarningModalProps {
  visible: boolean;
  onContinue: () => void;
}

export const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  visible,
  onContinue,
}) => {
  const [countdown, setCountdown] = useState(30);
  const startRef = useRef(0);

  useEffect(() => {
    if (visible) {
      startRef.current = Date.now();
      setCountdown(30);
      const id = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
        setCountdown(Math.max(0, 30 - elapsed));
      }, 1000);
      return () => clearInterval(id);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onContinue}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>⏰</Text>
          <Text style={styles.title}>Session Expiring</Text>
          <Text style={styles.message}>
            You'll be logged out in <Text style={styles.countdown}>{countdown}</Text> second{countdown !== 1 ? 's' : ''} due to inactivity.
          </Text>
          <TouchableOpacity style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>Continue Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  countdown: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  button: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
});
