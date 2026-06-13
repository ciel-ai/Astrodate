import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { profileStyles as styles } from './profileStyles';
import { PickerSheet } from './PickerSheet';
import type { ProfileData } from '../../hooks/useProfileData';

const availableInterests = [
  'Dancing', 'Basketball', 'Festivals', 'Cafe-hopping', 'Sense of adventure',
  'Astrology', 'Travel', 'Music', 'Reading', 'Cooking', 'Yoga', 'Fitness',
  'Photography', 'Art', 'Movies', 'Gaming', 'Hiking', 'Swimming', 'Tennis'
];

const availableLanguages = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Spanish',
  'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese'
];

const educationOptions = ['High School', 'Bachelor', 'Master', 'PhD', 'Other'];

const heightOptions = [
  "150 cm (4'11\")", "155 cm (5'1\")", "160 cm (5'3\")", "165 cm (5'4\")",
  "170 cm (5'7\")", "175 cm (5'9\")", "180 cm (5'11\")", "185 cm (6'1\")"
];

const drinkingOptions = ['Never', 'Sometimes', 'Often', 'Socially'];

const smokingOptions = ['Never', 'Sometimes', 'Regularly', 'Trying to quit'];

const lookingForOptions = [
  "We'll see (if the feeling is right)",
  'Friendship',
  'Long-term relationship',
  'Short-term relationship',
  'Marriage',
  'Something casual'
];

export function ProfileEditModal({ data }: { data: ProfileData }) {
  const router = useRouter();

  const {
    showEditModal, setShowEditModal,
    userPhotos, handleRemovePhoto,
    editedProfile, setEditedProfile,
    locationLoading, handleGetLocation,
    vedicSign,
    handleRemoveLookingFor, setShowLookingForPicker,
    handleRemoveInterest, setShowInterestPicker,
    setShowHeightPicker, setShowEducationPicker,
    setShowDrinkingPicker, setShowSmokingPicker,
    handleRemoveLanguage, setShowLanguagePicker,
    handleSave,
    // Picker specific states
    showLookingForPicker, showHeightPicker,
    showEducationPicker, showDrinkingPicker,
    showSmokingPicker, showInterestPicker,
    showLanguagePicker,
    handleAddLookingFor, handleAddInterest, handleAddLanguage,
    toggleArrayValue,
  } = data;

  return (
    <Modal
      visible={showEditModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowEditModal(false)}>
      <BlurView intensity={40} tint="dark" style={styles.modalOverlay}>
        <LinearGradient colors={['rgba(26, 13, 46, 0.9)', 'rgba(45, 27, 78, 0.95)']} style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={() => setShowEditModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
            {/* Photos Section */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Photos</Text>
              <Text style={styles.modalHint}>Add or remove photos (tap to remove)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
                {userPhotos.map((photo, index) => (
                  <View key={photo.id} style={styles.photoItem}>
                    <Image
                      source={{ uri: photo.photo_url }}
                      style={styles.photoThumbnail}
                      contentFit="cover"
                    />
                    {index !== 0 && (
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => handleRemovePhoto(photo.id)}>
                        <MaterialIcons name="close" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    {index === 0 && (
                      <View style={styles.mainPhotoBadge}>
                        <Text style={styles.mainPhotoBadgeText}>Main</Text>
                      </View>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addPhotoItem}
                  activeOpacity={0.7}
                  onPress={() => router.push('/onboarding/photo_upload')}>
                  <MaterialIcons name="add-circle-outline" size={40} color="#7C3AED" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Basic Info */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Basic Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editedProfile.name}
                  onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editedProfile.age.toString()}
                  onChangeText={() => { }}
                  placeholder="Age comes from birth details"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  keyboardType="numeric"
                  editable={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Location</Text>
                <View style={styles.modalInputRow}>
                  <TextInput
                    style={[styles.modalInput, styles.modalInputWithAction]}
                    value={editedProfile.location}
                    onChangeText={(text) => setEditedProfile({ ...editedProfile, location: text })}
                    placeholder="Enter your location"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  />
                  <TouchableOpacity
                    style={styles.modalLocationButton}
                    onPress={handleGetLocation}
                    disabled={locationLoading}
                    activeOpacity={0.7}>
                    {locationLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialIcons name="my-location" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Bio */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Bio</Text>
              <Text style={styles.modalHint}>Tell others about yourself</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editedProfile.bio}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, bio: text })}
                placeholder="Write a bio about yourself..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Astrology Signs (Read-only) */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Astrology</Text>
              <Text style={styles.modalHint}>These cannot be changed</Text>
              <View style={styles.readOnlyContainer}>
                <View style={styles.readOnlyItem}>
                  <MaterialIcons name="wb-sunny" size={20} color="#FFD700" />
                  <View style={styles.readOnlyContent}>
                    <Text style={styles.readOnlyLabel}>Western</Text>
                    <Text style={styles.readOnlyValue}>{editedProfile.sunSign || 'Not set'}</Text>
                  </View>
                </View>
                <View style={styles.readOnlyItem}>
                  <MaterialIcons name="nights-stay" size={20} color="#E0E0E0" />
                  <View style={styles.readOnlyContent}>
                    <Text style={styles.readOnlyLabel}>Vedic</Text>
                    <Text style={styles.readOnlyValue}>{vedicSign || 'Not set'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Looking For */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Looking For</Text>
              <Text style={styles.modalHint}>Tap to add or remove options</Text>
              <View style={styles.chipContainer}>
                {editedProfile.lookingFor.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, styles.chipSelected]}
                    onPress={() => handleRemoveLookingFor(option)}
                    activeOpacity={0.7}>
                    <Text style={styles.chipText}>{option}</Text>
                    <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowLookingForPicker(true)}
                activeOpacity={0.7}>
                <MaterialIcons name="add" size={20} color="#7C3AED" />
                <Text style={styles.addButtonText}>Add Looking For</Text>
              </TouchableOpacity>
            </View>

            {/* Interests */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Interests</Text>
              <Text style={styles.modalHint}>Tap to add or remove interests</Text>
              <View style={styles.chipContainer}>
                {editedProfile.interests.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.chip, styles.chipSelected]}
                    onPress={() => handleRemoveInterest(interest)}
                    activeOpacity={0.7}>
                    <Text style={styles.chipText}>{interest}</Text>
                    <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowInterestPicker(true)}
                activeOpacity={0.7}>
                <MaterialIcons name="add" size={20} color="#7C3AED" />
                <Text style={styles.addButtonText}>Add Interest</Text>
              </TouchableOpacity>
            </View>

            {/* More About Me */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>More About Me</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowHeightPicker(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.selectButtonText}>{editedProfile.height || 'Select height'}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Education</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowEducationPicker(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.selectButtonText}>{editedProfile.education || 'Select education'}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Drinking</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowDrinkingPicker(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.selectButtonText}>{editedProfile.drinking || 'Select drinking preference'}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Smoking</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowSmokingPicker(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.selectButtonText}>{editedProfile.smoking || 'Select smoking preference'}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Languages */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Languages</Text>
              <Text style={styles.modalHint}>Tap to add or remove languages</Text>
              <View style={styles.chipContainer}>
                {editedProfile.languages.map((language) => (
                  <TouchableOpacity
                    key={language}
                    style={[styles.chip, styles.chipSelected]}
                    onPress={() => handleRemoveLanguage(language)}
                    activeOpacity={0.7}>
                    <Text style={styles.chipText}>{language}</Text>
                    <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowLanguagePicker(true)}
                activeOpacity={0.7}>
                <MaterialIcons name="add" size={20} color="#7C3AED" />
                <Text style={styles.addButtonText}>Add Language</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowEditModal(false)}
              activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSave}
              activeOpacity={0.7}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Render Pickers as independent sheets via PickerSheet */}
          <PickerSheet
            title="Select Looking For"
            options={lookingForOptions}
            selected={editedProfile.lookingFor}
            onSelect={handleAddLookingFor}
            visible={showLookingForPicker}
            onClose={() => setShowLookingForPicker(false)}
            isMultiSelect={true}
            onMultiToggle={(value) => toggleArrayValue(editedProfile.lookingFor, value, handleAddLookingFor, handleRemoveLookingFor)}
          />

          <PickerSheet
            title="Select Height"
            options={heightOptions}
            selected={editedProfile.height}
            onSelect={(value) => setEditedProfile({ ...editedProfile, height: value })}
            visible={showHeightPicker}
            onClose={() => setShowHeightPicker(false)}
          />

          <PickerSheet
            title="Select Education"
            options={educationOptions}
            selected={editedProfile.education}
            onSelect={(value) => setEditedProfile({ ...editedProfile, education: value })}
            visible={showEducationPicker}
            onClose={() => setShowEducationPicker(false)}
          />

          <PickerSheet
            title="Select Drinking"
            options={drinkingOptions}
            selected={editedProfile.drinking}
            onSelect={(value) => setEditedProfile({ ...editedProfile, drinking: value })}
            visible={showDrinkingPicker}
            onClose={() => setShowDrinkingPicker(false)}
          />

          <PickerSheet
            title="Select Smoking"
            options={smokingOptions}
            selected={editedProfile.smoking}
            onSelect={(value) => setEditedProfile({ ...editedProfile, smoking: value })}
            visible={showSmokingPicker}
            onClose={() => setShowSmokingPicker(false)}
          />

          <PickerSheet
            title="Add Interests"
            options={availableInterests}
            selected={editedProfile.interests}
            onSelect={handleAddInterest}
            visible={showInterestPicker}
            onClose={() => setShowInterestPicker(false)}
            isMultiSelect={true}
            onMultiToggle={(value) => toggleArrayValue(editedProfile.interests, value, handleAddInterest, handleRemoveInterest)}
          />

          <PickerSheet
            title="Add Languages"
            options={availableLanguages}
            selected={editedProfile.languages}
            onSelect={handleAddLanguage}
            visible={showLanguagePicker}
            onClose={() => setShowLanguagePicker(false)}
            isMultiSelect={true}
            onMultiToggle={(value) => toggleArrayValue(editedProfile.languages, value, handleAddLanguage, handleRemoveLanguage)}
          />

        </LinearGradient>
      </BlurView>
    </Modal>
  );
}
