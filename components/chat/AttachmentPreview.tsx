import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';

interface AttachmentPreviewProps {
  visible: boolean;
  onClose: () => void;
  onPickPhoto: () => void;
  onTakePhoto: () => void;
  onPickVideo: () => void;
  onPickAudio: () => void;
}

export function AttachmentPreview({
  visible,
  onClose,
  onPickPhoto,
  onTakePhoto,
  onPickVideo,
  onPickAudio,
}: AttachmentPreviewProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.attachmentModal}>
          <View style={styles.attachmentHeader}>
            <Text style={styles.attachmentTitle}>Attach</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.attachmentGrid}>
            <TouchableOpacity style={styles.attachmentOption} onPress={onPickPhoto} activeOpacity={0.7}>
              <View style={[styles.attachmentIcon, { backgroundColor: '#3B82F6' }]}>
                <MaterialIcons name="photo-library" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.attachmentLabel}>Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachmentOption} onPress={onTakePhoto} activeOpacity={0.7}>
              <View style={[styles.attachmentIcon, { backgroundColor: '#10B981' }]}>
                <MaterialIcons name="photo-camera" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.attachmentLabel}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachmentOption} onPress={onPickVideo} activeOpacity={0.7}>
              <View style={[styles.attachmentIcon, { backgroundColor: '#EF4444' }]}>
                <MaterialIcons name="videocam" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.attachmentLabel}>Video</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachmentOption} onPress={onPickAudio} activeOpacity={0.7}>
              <View style={[styles.attachmentIcon, { backgroundColor: '#F97316' }]}>
                <MaterialIcons name="headphones" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.attachmentLabel}>Audio</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachmentModal: {
    backgroundColor: '#2D1B4E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '60%',
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  attachmentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  attachmentOption: {
    width: '22%',
    alignItems: 'center',
    marginBottom: 16,
  },
  attachmentIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
});