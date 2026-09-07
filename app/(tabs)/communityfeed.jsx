import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as DocumentPicker from 'expo-document-picker';

import GlossyCard from '../../components/GlossyCard';
import GlossyCardSmall from '../../components/GlossyCardSmall';
import PillButton from '../../components/PillButton';
import ScreenHeader from '../../components/ScreenHeader';

import { useTheme } from '../context/ThemeContext';

import { getCurrentUser, getRows, getUserProfile, getSupabaseClient, insertRow, subscribeToTable, updateRow } from '../../config/supabase';

const ALERT_TYPES = ['crime_alert', 'emergency_notice', 'service_update', 'general', 'jobs_opportunity', 'community'];

const getElapsedTime = (dateValue, now) => {
  if (!dateValue) return 'No alerts';

  const alertDate = new Date(dateValue);
  if (Number.isNaN(alertDate.getTime())) return 'No alerts';

  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - alertDate.getTime()) / 1000));
  const minutes = Math.floor(diffInSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (diffInSeconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return alertDate.toLocaleDateString();
};

const getGreeting = (name) => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return `Good morning, ${name} 👋`;
  if (hour >= 12 && hour < 18) return `Good day, ${name} 👋`;
  return `Good evening, ${name} 👋`;
};

export default function CommunityFeedScreen() {
  const { colors } = useTheme();

  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userRole, setUserRole] = useState('resident');
  const [modalVisible, setModalVisible] = useState(false);

  const [newPost, setNewPost] = useState({ title: '', description: '', type: 'general', pdf: null });

  const [submitting, setSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState(null);

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [wardDetails, setWardDetails] = useState(null);
  const [latestAlerts, setLatestAlerts] = useState({});
  const [now, setNow] = useState(new Date());

  const isLeader = userRole === 'community_leader' || userRole === 'leader';

  const fetchWardDetails = useCallback(async (profile) => {
    if (!profile?.ward_id) {
      setWardDetails(null);
      return;
    }

    const details = {
      wardId: profile.ward_id,
      wardNumber: profile.ward_number || null,
      suburbName: profile.suburb_name || null,
      cityName: profile.city_name || null,
      provinceName: profile.province_name || null,
    };

    try {
      const [ward] = await getRows('wards', { filters: { id: profile.ward_id } });

      if (ward) {
        details.wardNumber = details.wardNumber || ward.ward_number || ward.number || null;
        const suburbId = profile.suburb_id || ward.suburb_id;

        if (!details.suburbName && suburbId) {
          const [suburb] = await getRows('suburbs', { filters: { id: suburbId } });
          details.suburbName = suburb?.name || null;

          if (!details.cityName && suburb?.city_id) {
            const [city] = await getRows('cities', { filters: { id: suburb.city_id } });
            details.cityName = city?.name || null;

            if (!details.provinceName && city?.province_id) {
              const [province] = await getRows('provinces', { filters: { id: city.province_id } });
              details.provinceName = province?.name || null;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading ward details:', error);
    }

    setWardDetails(details);
  }, []);

  const loadFeed = useCallback(async (profile) => {
    setRefreshing(true);

    try {
      if (!profile?.ward_id) {
        setPosts([]);
        setLatestAlerts({});
        return;
      }

      const canViewArchive = profile.role === 'community_leader' || profile.role === 'leader';

      const postsData = await getRows('posts', {
        filters: { ward_id: profile.ward_id },
        order: [{ column: 'createdAt', ascending: false }],
      });

      const activePosts = postsData.filter((post) => post.status !== 'archived');
      const visiblePosts = canViewArchive ? postsData : activePosts;

      const latestByType = ALERT_TYPES.reduce((acc, type) => {
        acc[type] = activePosts.find((post) => post.type === type) || null;
        return acc;
      }, {});

      const crimeAlerts = visiblePosts.filter((post) => post.type === 'crime_alert');
      const others = visiblePosts.filter((post) => post.type !== 'crime_alert');

      setLatestAlerts(latestByType);
      setPosts([...crimeAlerts, ...others]);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe;

    const load = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      let profile = null;

      if (currentUser) {
        profile = await getUserProfile(currentUser.id);
        setUserProfile(profile);
        setUserRole(profile?.role || 'resident');
      }

      await fetchWardDetails(profile);
      await loadFeed(profile);

      unsubscribe = subscribeToTable('posts', () => loadFeed(profile));
    };

    load();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchWardDetails, loadFeed]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getCategoryIcon = (type) => {
    if (type === 'crime_alert') return 'alert-circle';
    if (type === 'emergency_notice') return 'warning';
    if (type === 'service_update') return 'construct';
    if (type === 'general') return 'megaphone';
    if (type === 'jobs_opportunity') return 'briefcase';
    if (type === 'community') return 'people';
    return 'newspaper';
  };

  const getCategoryColor = (type) => {
    if (type === 'crime_alert') return colors.error;
    if (type === 'emergency_notice') return colors.warning;
    if (type === 'service_update') return colors.primary;
    if (type === 'general') return colors.accent;
    if (type === 'jobs_opportunity') return colors.primary;
    if (type === 'community') return colors.primary;
    return colors.primary;
  };

  const getCategoryLabel = (type) => {
    if (type === 'crime_alert') return 'Crime Alert';
    if (type === 'emergency_notice') return 'Emergency Notice';
    if (type === 'service_update') return 'Service Update';
    if (type === 'general') return 'General';
    if (type === 'jobs_opportunity') return 'Jobs & Opportunities';
    if (type === 'community') return 'Community';
    return 'Update';
  };

  const handleArchivePost = (post) => {
    Alert.alert(
      'Archive Post',
      `Archive "${post.title}"? Residents will no longer see it in the community feed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            setArchivingId(post.id);

            try {
              const archivedPost = await updateRow('posts', post.id, { status: 'archived' });

              setPosts((currentPosts) =>
                currentPosts.map((currentPost) =>
                  currentPost.id === post.id ? { ...currentPost, ...archivedPost } : currentPost
                )
              );

              await loadFeed(userProfile);
            } catch (error) {
              Alert.alert('Error', 'Failed to archive post. Please try again.');
              console.error('Error archiving post:', error);
            } finally {
              setArchivingId(null);
            }
          },
        },
      ]
    );
  };

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) return;

      const isPdf = file.mimeType === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        Alert.alert('Invalid File', 'Please select a PDF document.');
        return;
      }

      const maxSize = 10 * 1024 * 1024;

      if (file.size && file.size > maxSize) {
        Alert.alert('File Too Large', 'Please select a PDF smaller than 10 MB.');
        return;
      }

      setNewPost((current) => ({ ...current, pdf: file }));
    } catch (error) {
      console.error('Error selecting PDF:', error);
      Alert.alert('Error', 'Unable to select the PDF. Please try again.');
    }
  };

  const uploadCommunityPdf = async (file) => {
    const supabase = getSupabaseClient();

    const response = await fetch(file.uri);
    const arrayBuffer = await response.arrayBuffer();

    const safeFileName = (file.name || 'community-update.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${userProfile.ward_id}/${user.id}/${Date.now()}-${safeFileName}`;

    const { error } = await supabase.storage
      .from('community-updates')
      .upload(filePath, arrayBuffer, { contentType: 'application/pdf', upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from('community-updates').getPublicUrl(filePath);

    return {
      url: data.publicUrl,
      name: file.name || 'Community Update.pdf',
      path: filePath,
    };
  };

  const handleOpenPdf = async (url) => {
    if (!url) {
      Alert.alert('PDF Unavailable', 'This community update does not have a PDF attached.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert('Unable to Open PDF', 'Your device could not open this document.');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', 'Unable to open the PDF.');
    }
  };

  const handleRegisterToVote = async () => {
    const url = 'https://registertovote.elections.org.za/';

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert('Unable to Open', 'Your device could not open the IEC voter registration portal.');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening voter registration:', error);
      Alert.alert('Error', 'Unable to open the IEC voter registration portal.');
    }
  };

  const handleVerifyRegistration = async () => {
    const url = 'https://www.elections.org.za/';

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert('Unable to Open', 'Your device could not open the IEC website.');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening voter verification:', error);
      Alert.alert('Error', 'Unable to open the IEC website.');
    }
  };

  const handleCreatePost = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a post');
      return;
    }

    if (!newPost.title.trim()) {
      Alert.alert('Error', 'Please enter a title for the community update.');
      return;
    }

    if (!newPost.description.trim() && !newPost.pdf) {
      Alert.alert('Content Required', 'Please add a description or attach a PDF document.');
      return;
    }

    if (!userProfile?.ward_id) {
      Alert.alert('Ward Required', 'Your profile needs a ward before you can create ward community posts.');
      return;
    }

    setSubmitting(true);

    let uploadedPdf = null;

    try {
      const firstName = userProfile?.firstName?.trim() || '';
      const lastName = userProfile?.lastName?.trim() || '';
      const createdByName = `${firstName} ${lastName}`.trim() || 'Community Leader';

      if (newPost.pdf) {
        uploadedPdf = await uploadCommunityPdf(newPost.pdf);
      }

      const createdPost = await insertRow('posts', {
        type: newPost.type,
        title: newPost.title.trim(),
        description: newPost.description.trim() || 'Official community document',
        createdBy: user.id,
        createdByName,
        createdAt: new Date().toISOString(),
        status: 'approved',
        priority: newPost.type === 'crime_alert' ? 'high' : 'normal',
        ward_id: userProfile.ward_id,
        suburb_id: userProfile.suburb_id || null,
        pdf_url: uploadedPdf?.url || null,
        pdf_name: uploadedPdf?.name || null,
      });

      setPosts((currentPosts) => {
        const nextPosts = [createdPost, ...currentPosts.filter((post) => post.id !== createdPost.id)];
        const crimeAlerts = nextPosts.filter((post) => post.type === 'crime_alert');
        const others = nextPosts.filter((post) => post.type !== 'crime_alert');
        return [...crimeAlerts, ...others];
      });

      setLatestAlerts((currentAlerts) => ({
        ...currentAlerts,
        [createdPost.type]: createdPost,
      }));

      Alert.alert('Success', 'Community update published successfully.');

      setModalVisible(false);

      setNewPost({ title: '', description: '', type: 'general', pdf: null });
    } catch (error) {
      console.error('Error creating community post:', error);
      Alert.alert('Error', error?.message || 'Failed to create community update. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const activePosts = posts.filter((post) => post.status !== 'archived');
  const archivedPosts = isLeader ? posts.filter((post) => post.status === 'archived') : [];

  const filteredPosts =
    selectedCategory === 'archive'
      ? archivedPosts
      : selectedCategory === 'all'
        ? activePosts
        : activePosts.filter((post) => post.type === selectedCategory);

  const wardTitle = wardDetails?.wardNumber
    ? `Ward ${wardDetails.wardNumber}`
    : wardDetails?.wardId ? `Ward ${wardDetails.wardId}` : 'No ward assigned';

  const wardLocation = [wardDetails?.suburbName, wardDetails?.cityName, wardDetails?.provinceName]
    .filter(Boolean)
    .join(' • ');

  const firstName = userProfile?.firstName?.trim() || '';
  const lastName = userProfile?.lastName?.trim() || '';
  const userName = `${firstName} ${lastName}`.trim() || 'Resident';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader
          title={getGreeting(userName)}
          subtitle={`Welcome to ${wardTitle}`}
          meta={wardLocation || 'Add your ward to see local community updates'}
          icon="people-circle"
        />

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFeed(userProfile)} tintColor={colors.primary} />}
        >
          <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { icon: 'alert-circle', color: colors.error, post: latestAlerts.crime_alert, label: 'Last Ward Crime', emptyText: 'No crime alerts' },
                { icon: 'warning', color: colors.warning, post: latestAlerts.emergency_notice, label: 'Last Emergency', emptyText: 'No emergency notices' },
                { icon: 'construct', color: colors.primary, post: latestAlerts.service_update, label: 'Last Service Update', emptyText: 'No service updates' },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1 }}>
                  <GlossyCardSmall style={{ marginVertical: 4, minHeight: 116, paddingHorizontal: 10, paddingVertical: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: `${item.color}18`, justifyContent: 'center', alignItems: 'center', marginRight: 7 }}>
                        <Ionicons name={item.icon} size={16} color={item.color} />
                      </View>
                      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>
                        {item.post ? getElapsedTime(item.post.createdAt, now) : 'No alerts'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textLight, fontSize: 10, lineHeight: 14, marginTop: 5 }} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', lineHeight: 15, marginTop: 5 }} numberOfLines={3}>
                      {item.post?.title || item.emptyText}
                    </Text>
                  </GlossyCardSmall>
                </View>
              ))}
            </View>
          </View>

          <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>Civic Services</Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <GlossyCardSmall style={{ minHeight: 92, paddingHorizontal: 12, paddingVertical: 11 }}>
                  <TouchableOpacity onPress={handleRegisterToVote} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.primary}18`, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                        <Ionicons name="checkbox-outline" size={19} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Register to Vote</Text>
                        <Text style={{ color: colors.textLight, fontSize: 10, marginTop: 3, lineHeight: 14 }} numberOfLines={2}>
                          Register through the official IEC
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 7 }}>
                      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', marginRight: 3 }}>Open IEC</Text>
                      <Ionicons name="open-outline" size={12} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                </GlossyCardSmall>
              </View>

              <View style={{ flex: 1 }}>
                <GlossyCardSmall style={{ minHeight: 92, paddingHorizontal: 12, paddingVertical: 11 }}>
                  <TouchableOpacity onPress={handleVerifyRegistration} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.accent}18`, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                        <Ionicons name="checkmark-circle-outline" size={19} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Verify Registration</Text>
                        <Text style={{ color: colors.textLight, fontSize: 10, marginTop: 3, lineHeight: 14 }} numberOfLines={2}>
                          Check your IEC voter status
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 7 }}>
                      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '800', marginRight: 3 }}>Check Status</Text>
                      <Ionicons name="open-outline" size={12} color={colors.accent} />
                    </View>
                  </TouchableOpacity>
                </GlossyCardSmall>
              </View>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, height: 46 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 7 }}
          >
            {[
              'all',
              'crime_alert',
              'emergency_notice',
              'service_update',
              'general',
              'jobs_opportunity',
              'community',
              ...(isLeader ? ['archive'] : []),
            ].map((category) => {
              const isSelected = selectedCategory === category;
              const title = category === 'all' ? 'All Updates' : category === 'archive' ? 'Archive' : getCategoryLabel(category);

              return (
                <PillButton
                  key={category}
                  title={title}
                  onPress={() => setSelectedCategory(category)}
                  variant={isSelected ? 'primary' : 'outline'}
                  compact
                />
              );
            })}
          </ScrollView>

          {isLeader && (
            <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 }}>
              <PillButton
                title="Create Community Update"
                onPress={() => setModalVisible(true)}
                variant="primary"
                style={{ minHeight: 38 }}
              />
            </View>
          )}

          <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 30 }}>
            <View style={{ marginTop: 0, marginBottom: 4 }}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>Community Updates</Text>
              <Text style={{ color: colors.textLight, fontSize: 13, marginTop: 3 }}>What's happening in {wardTitle}</Text>
            </View>

            {filteredPosts.length === 0 ? (
              <GlossyCard>
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Ionicons name="newspaper-outline" size={52} color={colors.textLight} />
                  <Text style={{ color: colors.textLight, marginTop: 12, textAlign: 'center', lineHeight: 20 }}>
                    {selectedCategory === 'archive'
                      ? 'No archived posts in your ward yet.'
                      : 'No posts in your ward yet. Check back later for community updates.'}
                  </Text>
                </View>
              </GlossyCard>
            ) : (
              filteredPosts.map((post) => {
                const isArchiving = archivingId === post.id;
                const isArchived = post.status === 'archived';
                const categoryColor = getCategoryColor(post.type);

                return (
                  <View key={post.id} style={{ opacity: isArchiving ? 0.5 : 1 }}>
                    <GlossyCard variant="default" style={{ marginVertical: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${categoryColor}18`, justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name={getCategoryIcon(post.type)} size={21} color={categoryColor} />
                        </View>

                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: categoryColor }}>
                            {getCategoryLabel(post.type)}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>
                            {post.createdByName || 'Community'} • {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Just now'}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          {post.priority === 'high' && (
                            <View style={{ backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                              <Text style={{ color: colors.textInverse, fontSize: 9, fontWeight: '800' }}>URGENT</Text>
                            </View>
                          )}

                          {isArchived && (
                            <View style={{ backgroundColor: colors.surfaceSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                              <Text style={{ color: colors.textLight, fontSize: 9, fontWeight: '800' }}>ARCHIVED</Text>
                            </View>
                          )}

                          {isLeader && !isArchived && (
                            <TouchableOpacity
                              onPress={() => handleArchivePost(post)}
                              disabled={isArchiving}
                              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.whiteSoft, justifyContent: 'center', alignItems: 'center' }}
                            >
                              {isArchiving ? (
                                <ActivityIndicator size="small" color={colors.warning} />
                              ) : (
                                <Ionicons name="archive-outline" size={17} color={colors.warning} />
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 7 }}>
                        {post.title}
                      </Text>

                      {post.description && post.description !== 'Official community document' && (
                        <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textLight, marginBottom: post.pdf_url ? 14 : 0 }}>
                          {post.description}
                        </Text>
                      )}

                      {post.pdf_url && (
                        <View style={{ marginTop: 4, padding: 14, borderRadius: 16, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${categoryColor}18`, justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name="document-text" size={22} color={categoryColor} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>Official Community Document</Text>
                              <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                                {post.pdf_name || 'Community Update.pdf'}
                              </Text>
                            </View>
                          </View>

                          <PillButton
                            title="View PDF"
                            onPress={() => handleOpenPdf(post.pdf_url)}
                            variant="outline"
                            compact
                          />
                        </View>
                      )}
                    </GlossyCard>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => !submitting && setModalVisible(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
              <View style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 24,
                paddingBottom: Platform.OS === 'ios' ? 36 : 24,
                maxHeight: '90%',
              }}>
                <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 }} />

                <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 18, color: colors.text }}>Create Community Update</Text>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 10, color: colors.text }}>Category</Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                    {['crime_alert', 'emergency_notice', 'service_update', 'general', 'jobs_opportunity', 'community'].map((type) => (
                      <PillButton
                        key={type}
                        title={getCategoryLabel(type)}
                        onPress={() => setNewPost({ ...newPost, type })}
                        variant={newPost.type === type ? 'primary' : 'outline'}
                        compact
                      />
                    ))}
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8, color: colors.text }}>Title</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: colors.border, color: colors.text, minHeight: 50 }}
                    placeholder="Community update title"
                    placeholderTextColor={colors.inputPlaceholder}
                    selectionColor={colors.accent}
                    value={newPost.title}
                    onChangeText={(text) => setNewPost({ ...newPost, title: text })}
                    returnKeyType="next"
                  />

                  <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8, color: colors.text }}>Description</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.border, minHeight: 120, textAlignVertical: 'top', color: colors.text }}
                    placeholder="Optional description..."
                    placeholderTextColor={colors.inputPlaceholder}
                    selectionColor={colors.accent}
                    multiline
                    value={newPost.description}
                    onChangeText={(text) => setNewPost({ ...newPost, description: text })}
                  />

                  <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8, color: colors.text }}>Official PDF Document</Text>

                  <TouchableOpacity
                    onPress={handlePickPdf}
                    disabled={submitting}
                    style={{ backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Ionicons name={newPost.pdf ? 'document-text' : 'document-attach-outline'} size={24} color={colors.primary} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                        {newPost.pdf?.name || 'Select PDF document'}
                      </Text>
                      <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>
                        {newPost.pdf ? 'PDF selected and ready to publish' : 'Upload an official community document'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <PillButton
                      title="Cancel"
                      onPress={() => { if (!submitting) setModalVisible(false); }}
                      variant="outline"
                      disabled={submitting}
                      style={{ flex: 1 }}
                    />

                    <PillButton
                      title="Publish Update"
                      onPress={handleCreatePost}
                      loading={submitting}
                      disabled={submitting}
                      variant="primary"
                      style={{ flex: 1 }}
                    />
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}