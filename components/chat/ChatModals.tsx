import { createReport } from '@/lib/reports';
import { useAuthAlert } from '@/lib/auth-alert-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export type ChatModalsRef = {
  openMenu: () => void;
};

type ChatModalsProps = {
  chatId: string;
  channelId: string | null;
  userName: string;
  onUnmatch: () => Promise<void>;
  onReport: () => Promise<void>;
  onBlock: () => Promise<void>;
};

function getSubcategoriesForCategory(category: string): string[] {
  switch (category) {
    case 'Something on their profile':
      return ['Photos or videos', 'Profile text'];
    case 'Behavior on AstroDate':
      return ['Inappropriate messages', 'Harassment', 'Spam', 'Other'];
    case "They shouldn't be on AstroDate":
      return ['Underage', 'Fake profile', 'Scam', 'Other'];
    default:
      return [];
  }
}

const ChatModals = forwardRef<ChatModalsRef, ChatModalsProps>(function ChatModals(
  { chatId, channelId, userName, onUnmatch, onReport, onBlock },
  ref,
) {
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showDidYouMeetModal, setShowDidYouMeetModal] = useState(false);
  const [showSeeAgainModal, setShowSeeAgainModal] = useState(false);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [showUnmatchModal, setShowUnmatchModal] = useState(false);
  const [showUnmatchReasonModal, setShowUnmatchReasonModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportCategoryModal, setShowReportCategoryModal] = useState(false);
  const [showReportSubcategoryModal, setShowReportSubcategoryModal] = useState(false);
  const [showReportDetailsModal, setShowReportDetailsModal] = useState(false);
  const [showReportConfirmationModal, setShowReportConfirmationModal] = useState(false);
  const [selectedReportCategory, setSelectedReportCategory] = useState('');
  const [selectedReportSubcategory, setSelectedReportSubcategory] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSaved, setReportSaved] = useState(false);
  const { showAlert } = useAuthAlert();

  useImperativeHandle(ref, () => ({
    openMenu: () => setShowMenuModal(true),
  }));

  const handleSubcategoryPress = useCallback(async (subcategory: string) => {
    setSelectedReportSubcategory(subcategory);
    setShowReportSubcategoryModal(false);

    const needsDetails =
      selectedReportCategory === 'Something on their profile' || subcategory === 'Other';

    if (needsDetails) {
      setShowReportDetailsModal(true);
      return;
    }

    if (chatId && !reportSaved) {
      const result = await createReport(chatId, selectedReportCategory, subcategory, undefined, channelId ?? undefined);
      if (result.success) {
        setReportSaved(true);
      } else {
        showAlert('Error', 'Failed to save report. Please try again.');
        return;
      }
    }
    setTimeout(() => setShowReportConfirmationModal(true), 300);
  }, [selectedReportCategory, chatId, channelId, reportSaved, showAlert]);

  const handleSubmitDetails = useCallback(async () => {
    if (chatId && selectedReportCategory && selectedReportSubcategory && !reportSaved) {
      const result = await createReport(chatId, selectedReportCategory, selectedReportSubcategory, reportDetails, channelId ?? undefined);
      if (result.success) {
        setReportSaved(true);
      } else {
        showAlert('Error', 'Failed to save report. Please try again.');
        return;
      }
    }
    setShowReportDetailsModal(false);
    setTimeout(() => setShowReportConfirmationModal(true), 300);
  }, [chatId, channelId, selectedReportCategory, selectedReportSubcategory, reportDetails, reportSaved, showAlert]);

  const handleConfirmDone = useCallback(async () => {
    setShowReportConfirmationModal(false);
    if (!reportSaved && chatId && selectedReportCategory && selectedReportSubcategory) {
      const result = await createReport(chatId, selectedReportCategory, selectedReportSubcategory, reportDetails || undefined, channelId ?? undefined);
      if (result.success) {
        setReportSaved(true);
        await new Promise((r) => setTimeout(r, 300));
      } else {
        showAlert('Error', 'Failed to save report. Please try again.');
        return;
      }
    } else if (reportSaved) {
      await new Promise((r) => setTimeout(r, 200));
    }
    await onReport();
  }, [reportSaved, chatId, channelId, selectedReportCategory, selectedReportSubcategory, reportDetails, onReport, showAlert]);

  const handleBlock = useCallback(() => {
    setShowMenuModal(false);
    Alert.alert(
      `Block ${userName}`,
      `${userName} won't be able to message you or see your profile. They won't be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => onBlock() },
      ],
    );
  }, [userName, onBlock]);

  const openReport = useCallback(() => {
    setShowMenuModal(false);
    setReportSaved(false);
    setSelectedReportCategory('');
    setSelectedReportSubcategory('');
    setReportDetails('');
    setShowReportModal(true);
  }, []);

  return (
    <>
      {/* Menu */}
      <Modal visible={showMenuModal} transparent animationType="fade" onRequestClose={() => setShowMenuModal(false)}>
        <TouchableOpacity style={styles.menuModalOverlay} activeOpacity={1} onPress={() => setShowMenuModal(false)}>
          <View style={styles.menuModal}>
            <TouchableOpacity style={styles.menuOption} onPress={() => { setShowMenuModal(false); setShowDidYouMeetModal(true); }} activeOpacity={0.7}>
              <Text style={styles.menuOptionText}>Did you meet?</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuOption} onPress={() => { setShowMenuModal(false); setShowUnmatchModal(true); }} activeOpacity={0.7}>
              <Text style={styles.menuOptionText}>Unmatch</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuOption} onPress={handleBlock} activeOpacity={0.7}>
              <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>Block</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuOption} onPress={openReport} activeOpacity={0.7}>
              <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>Report</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Did you meet */}
      <Modal visible={showDidYouMeetModal} transparent animationType="slide" onRequestClose={() => setShowDidYouMeetModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDidYouMeetModal(false)}>
          <View style={styles.didYouMeetModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowDidYouMeetModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.didYouMeetTitle}>Did you and {userName} meet?</Text>
            <Text style={styles.didYouMeetSubtitle}>
              We'll never share your answer. It just helps us learn more about the best people to show you.
            </Text>
            <TouchableOpacity style={styles.didYouMeetButton} onPress={() => { setShowDidYouMeetModal(false); setShowSeeAgainModal(true); }} activeOpacity={0.8}>
              <Text style={styles.didYouMeetButtonText}>Yes, we met</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.didYouMeetButtonSecondary} onPress={() => setShowDidYouMeetModal(false)} activeOpacity={0.8}>
              <Text style={styles.didYouMeetButtonTextSecondary}>No, we didn't meet</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* See again */}
      <Modal visible={showSeeAgainModal} transparent animationType="slide" onRequestClose={() => setShowSeeAgainModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSeeAgainModal(false)}>
          <View style={styles.seeAgainModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSeeAgainModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => { setShowSeeAgainModal(false); setShowDidYouMeetModal(true); }} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color="#1B1528" />
            </TouchableOpacity>
            <Text style={styles.seeAgainTitle}>Is {userName} the kind of person you'd like to see again?</Text>
            <Text style={styles.seeAgainSubtitle}>We'll keep this answer private, too.</Text>
            <TouchableOpacity style={styles.seeAgainButton} onPress={() => { setShowSeeAgainModal(false); setShowThanksModal(true); }} activeOpacity={0.8}>
              <Text style={styles.seeAgainButtonText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.seeAgainButtonSecondary} onPress={() => { setShowSeeAgainModal(false); setShowThanksModal(true); }} activeOpacity={0.8}>
              <Text style={styles.seeAgainButtonTextSecondary}>No</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Thanks */}
      <Modal visible={showThanksModal} transparent animationType="fade" onRequestClose={() => setShowThanksModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowThanksModal(false)}>
          <View style={styles.thanksModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowThanksModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.thanksIllustration}>
              <Text style={styles.thanksHeart}>🤝</Text>
            </View>
            <Text style={styles.thanksTitle}>Thanks for sharing!</Text>
            <Text style={styles.thanksSubtitle}>
              We love to hear that! Your answers help us find more great people for you to date.
            </Text>
            <TouchableOpacity style={styles.thanksButton} onPress={() => setShowThanksModal(false)} activeOpacity={0.8}>
              <Text style={styles.thanksButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Unmatch */}
      <Modal visible={showUnmatchModal} transparent animationType="slide" onRequestClose={() => setShowUnmatchModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowUnmatchModal(false)}>
          <View style={styles.unmatchModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowUnmatchModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.unmatchCheckmark}>
              <MaterialIcons name="check-circle" size={48} color="#10B981" />
            </View>
            <Text style={styles.unmatchTitle}>You've unmatched {userName}</Text>
            <Text style={styles.unmatchSubtitle}>
              Could you tell us why? Your reason will help us show you the right people. They won't know why you've unmatched.
            </Text>
            <View style={styles.unmatchReasonsList}>
              {["We've moved off the app", 'Different relationship goals', "They didn't reply", 'They made me feel uncomfortable', 'Something else'].map((reason, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.unmatchReasonOption}
                  onPress={() => { setShowUnmatchModal(false); setShowUnmatchReasonModal(true); }}
                  activeOpacity={0.7}>
                  <Text style={styles.unmatchReasonText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Unmatch reason confirmation */}
      <Modal visible={showUnmatchReasonModal} transparent animationType="fade" onRequestClose={() => setShowUnmatchReasonModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowUnmatchReasonModal(false)}>
          <View style={styles.unmatchReasonModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowUnmatchReasonModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.thanksIllustration}>
              <Text style={styles.thanksHeart}>🤝</Text>
            </View>
            <Text style={styles.thanksTitle}>Thanks for sharing!</Text>
            <Text style={styles.thanksSubtitle}>
              We love to hear that! Your answers help us find more great people for you to date.
            </Text>
            <TouchableOpacity
              style={styles.thanksButton}
              onPress={async () => { setShowUnmatchReasonModal(false); await onUnmatch(); }}
              activeOpacity={0.8}>
              <Text style={styles.thanksButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report — step 1 */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportModal(false)}>
          <View style={styles.reportModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowReportModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.reportTitle}>Report {userName}</Text>
            <Text style={styles.reportDescription}>
              Let us know when someone's broken our guidelines. They won't know that you've reported them, or why.
            </Text>
            <View style={styles.reportStepsContainer}>
              {['Let us know what happened', 'We\'ll investigate your report', 'We\'ll keep you updated'].map((step, i) => (
                <View key={i} style={styles.reportStep}>
                  <View style={styles.reportStepNumber}>
                    <Text style={styles.reportStepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.reportStepText}>{step}</Text>
                </View>
              ))}
            </View>
            <View style={styles.unmatchSuggestion}>
              <MaterialIcons name="close" size={16} color="#6B7280" />
              <Text style={styles.unmatchSuggestionText}>Don't think they've broken our guidelines? Unmatch instead</Text>
            </View>
            <TouchableOpacity style={styles.reportStartButton} onPress={() => { setShowReportModal(false); setShowReportCategoryModal(true); }} activeOpacity={0.8}>
              <Text style={styles.reportStartButtonText}>Start report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportUnmatchButton} onPress={() => { setShowReportModal(false); setShowUnmatchModal(true); }} activeOpacity={0.8}>
              <Text style={styles.reportUnmatchButtonText}>Unmatch instead</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report — step 2: category */}
      <Modal visible={showReportCategoryModal} transparent animationType="slide" onRequestClose={() => setShowReportCategoryModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportCategoryModal(false)}>
          <View style={styles.reportCategoryModal}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => { setShowReportCategoryModal(false); setShowReportModal(true); }} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color="#1B1528" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowReportCategoryModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.reportCategoryTitle}>What do you want to report?</Text>
            <Text style={styles.reportCategorySubtitle}>
              We'll keep this private, and they won't know you've reported them. This helps us keep AstroDate safe.
            </Text>
            <View style={styles.reportCategoryList}>
              {['Something on their profile', 'Behavior on AstroDate', "They shouldn't be on AstroDate"].map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.reportCategoryOption}
                  onPress={() => { setSelectedReportCategory(category); setShowReportCategoryModal(false); setShowReportSubcategoryModal(true); }}
                  activeOpacity={0.7}>
                  <Text style={styles.reportCategoryOptionText}>{category}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report — step 3: subcategory */}
      <Modal visible={showReportSubcategoryModal} transparent animationType="slide" onRequestClose={() => setShowReportSubcategoryModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportSubcategoryModal(false)}>
          <View style={styles.reportSubcategoryModal}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => { setShowReportSubcategoryModal(false); setShowReportCategoryModal(true); }} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color="#1B1528" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowReportSubcategoryModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.reportSubcategoryTitle}>{selectedReportCategory}</Text>
            <View style={styles.reportSubcategoryList}>
              {getSubcategoriesForCategory(selectedReportCategory).map((sub, index) => (
                <TouchableOpacity key={index} style={styles.reportSubcategoryOption} onPress={() => handleSubcategoryPress(sub)} activeOpacity={0.7}>
                  <Text style={styles.reportSubcategoryOptionText}>{sub}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report — step 4: details */}
      <Modal visible={showReportDetailsModal} transparent animationType="slide" onRequestClose={() => setShowReportDetailsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportDetailsModal(false)}>
          <View style={styles.reportDetailsModal}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => { setShowReportDetailsModal(false); setShowReportSubcategoryModal(true); }} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color="#1B1528" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowReportDetailsModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.reportDetailsTitle}>Tell us more about {selectedReportSubcategory}</Text>
            <Text style={styles.reportDetailsSubtitle}>Please provide additional details to help us investigate your report.</Text>
            <TextInput
              style={styles.reportDetailsInput}
              placeholder="Describe what happened..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={reportDetails}
              onChangeText={setReportDetails}
            />
            <TouchableOpacity style={styles.reportSubmitButton} onPress={handleSubmitDetails} activeOpacity={0.8}>
              <Text style={styles.reportSubmitButtonText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report — step 5: confirmation */}
      <Modal visible={showReportConfirmationModal} transparent animationType="fade" onRequestClose={() => setShowReportConfirmationModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportConfirmationModal(false)}>
          <View style={styles.reportConfirmationModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowReportConfirmationModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.reportCheckmark}>
              <MaterialIcons name="check-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.reportConfirmationTitle}>You've blocked and reported {userName}</Text>
            <Text style={styles.reportConfirmationSubtitle}>
              Thanks for helping protect the AstroDate community. You'll receive updates on your report in the Help Hub on your profile page.
            </Text>
            <TouchableOpacity style={styles.reportDoneButton} onPress={handleConfirmDone} activeOpacity={0.8}>
              <Text style={styles.reportDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
});

export default ChatModals;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalBackButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  // Menu
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuModal: {
    backgroundColor: 'rgba(26, 11, 46, 0.98)',
    borderRadius: 12,
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 16,
    minWidth: 220,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuOptionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  menuOptionTextDanger: {
    color: '#EF4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  // Did you meet
  didYouMeetModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '60%',
  },
  didYouMeetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 12,
  },
  didYouMeetSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  didYouMeetButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  didYouMeetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  didYouMeetButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1B1528',
  },
  didYouMeetButtonTextSecondary: {
    color: '#1B1528',
    fontSize: 16,
    fontWeight: '600',
  },
  // See again
  seeAgainModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '60%',
  },
  seeAgainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 12,
  },
  seeAgainSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  seeAgainButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAgainButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  seeAgainButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1B1528',
  },
  seeAgainButtonTextSecondary: {
    color: '#1B1528',
    fontSize: 16,
    fontWeight: '600',
  },
  // Thanks / unmatch reason
  thanksModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    maxWidth: '90%',
  },
  thanksIllustration: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  thanksHeart: {
    fontSize: 80,
  },
  thanksTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginBottom: 12,
    textAlign: 'center',
  },
  thanksSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  thanksButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  thanksButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Unmatch
  unmatchModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '80%',
  },
  unmatchCheckmark: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  unmatchTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    textAlign: 'center',
    marginBottom: 12,
  },
  unmatchSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  unmatchReasonsList: {
    gap: 12,
  },
  unmatchReasonOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unmatchReasonText: {
    fontSize: 16,
    color: '#1B1528',
    fontWeight: '500',
  },
  unmatchReasonModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    maxWidth: '90%',
  },
  // Unmatch suggestion (shown inside report modal)
  unmatchSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  unmatchSuggestionText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  // Report
  reportModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  reportTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B1528',
    marginBottom: 12,
  },
  reportDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  reportStepsContainer: {
    marginBottom: 24,
    gap: 16,
  },
  reportStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B1528',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportStepNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reportStepText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  reportStartButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  reportStartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reportUnmatchButton: {
    backgroundColor: '#6B7280',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reportUnmatchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reportCategoryModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  reportCategoryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 8,
  },
  reportCategorySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  reportCategoryList: {
    gap: 0,
  },
  reportCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reportCategoryOptionText: {
    fontSize: 16,
    color: '#1B1528',
    fontWeight: '500',
  },
  reportSubcategoryModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  reportSubcategoryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 24,
  },
  reportSubcategoryList: {
    gap: 0,
  },
  reportSubcategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reportSubcategoryOptionText: {
    fontSize: 16,
    color: '#1B1528',
    fontWeight: '500',
  },
  reportDetailsModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  reportDetailsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 8,
  },
  reportDetailsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  reportDetailsInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1B1528',
    minHeight: 120,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportSubmitButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reportSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reportConfirmationModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    maxWidth: '90%',
  },
  reportCheckmark: {
    marginBottom: 20,
  },
  reportConfirmationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    textAlign: 'center',
    marginBottom: 12,
  },
  reportConfirmationSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  reportDoneButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
  },
  reportDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
