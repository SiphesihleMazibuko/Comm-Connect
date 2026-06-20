import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../Utils/colors';
import { deleteRow, getCurrentUser, getRows, getUserProfile, insertRow, subscribeToTable } from '../../config/supabase';

export default function CommunityFeedScreen() {
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userRole, setUserRole] = useState('resident');
  const [modalVisible, setModalVisible] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', description: '', type: 'crime_alert' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const isLeader = userRole === 'community_leader' || userRole === 'leader';

  useEffect(() => {
    let unsubscribe;

    const load = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const profile = await getUserProfile(currentUser.id);
        setUserProfile(profile);
        setUserRole(profile?.role || 'resident');
      }
      await loadFeed();
      unsubscribe = subscribeToFeed();
    };

    load();
    return () => unsubscribe && unsubscribe();
  }, []);

  const loadFeed = async () => {
    try {
      let postsData;
      
      // If user has a ward, only show posts from their ward
      if (userProfile?.ward_id) {
        postsData = await getRows('posts', {
          filters: { ward_id: userProfile.ward_id },
          order: [{ column: 'createdAt', ascending: false }],
        });
      } else {
        // Fallback: show all posts if no ward assigned
        postsData = await getRows('posts', {
          order: [{ column: 'createdAt', ascending: false }],
        });
      }

      const crimeAlerts = postsData.filter(p => p.type === 'crime_alert');
      const others = postsData.filter(p => p.type !== 'crime_alert');
      setPosts([...crimeAlerts, ...others]);
    } catch (error) {
      console.error('Error loading feed:', error);
    }
  };

  const subscribeToFeed = () => {
    return subscribeToTable('posts', loadFeed);
  };

  const getCategoryIcon = (type) => {
    switch(type) {
      case 'crime_alert': return 'alert-circle';
      case 'emergency_notice': return 'warning';
      case 'service_update': return 'construct';
      default: return 'newspaper';
    }
  };

  const getCategoryColor = (type) => {
    switch(type) {
      case 'crime_alert': return colors.error;
      case 'emergency_notice': return colors.warning;
      case 'service_update': return colors.accent;
      default: return colors.primary;
    }
  };

  const getCategoryLabel = (type) => {
    switch(type) {
      case 'crime_alert': return 'Crime Alert';
      case 'emergency_notice': return 'Emergency Notice';
      case 'service_update': return 'Service Update';
      default: return 'Update';
    }
  };

  const handleDeletePost = (post) => {
    Alert.alert(
      'Delete Post',
      `Are you sure you want to delete "${post.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(post.id);
            try {
              await deleteRow('posts', post.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post. Please try again.');
              console.error('Error deleting post:', error);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCreatePost = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a post');
      return;
    }

    if (!newPost.title || !newPost.description) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await insertRow('posts', {
        type: newPost.type,
        title: newPost.title,
        description: newPost.description,
        createdBy: user.id,
        createdByName: user.user_metadata?.full_name || 'Community Leader',
        createdAt: new Date().toISOString(),
        status: 'approved',
        priority: newPost.type === 'crime_alert' ? 'high' : 'normal',
        // Add ward_id to posts for filtering
        ward_id: userProfile?.ward_id || null,
        suburb_id: userProfile?.suburb_id || null,
      });

      Alert.alert('Success', 'Post created successfully');
      setModalVisible(false);
      setNewPost({ title: '', description: '', type: 'crime_alert' });
    } catch (error) {
      Alert.alert('Error', 'Failed to create post');
      console.error('Error adding document: ', error);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPosts = selectedCategory === 'all'
    ? posts
    : posts.filter(post => post.type === selectedCategory);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Header */}
        <View style={{ backgroundColor: colors.primary, padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Community Feed</Text>
          {userProfile?.ward_number && (
            <Text style={{ fontSize: 14, color: '#fff', opacity: 0.8 }}>
              Ward {userProfile.ward_number} • {userProfile.suburb_name || 'Your Community'}
            </Text>
          )}
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', margin: 16, gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
            <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>24/7</Text>
            <Text style={{ fontSize: 12, color: colors.textLight }}>Community Alert</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
            <Ionicons name="location" size={24} color={colors.accent} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>PinPoint</Text>
            <Text style={{ fontSize: 12, color: colors.textLight }}>Digital Address</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
            <Ionicons name="people" size={24} color={colors.accent} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>Active</Text>
            <Text style={{ fontSize: 12, color: colors.textLight }}>Community</Text>
          </View>
        </View>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', gap: 10 }}
          style={{ maxHeight: 52, marginBottom: 4 }}
        >
          {['all', 'crime_alert', 'emergency_notice', 'service_update'].map((category) => (
            <TouchableOpacity
              key={category}
              style={{
                backgroundColor: selectedCategory === category ? colors.accent : colors.surface,
                paddingHorizontal: 18,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: selectedCategory === category ? colors.accent : colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                elevation: selectedCategory === category ? 3 : 1,
                shadowColor: colors.accent,
                shadowOpacity: selectedCategory === category ? 0.3 : 0,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
              }}
              onPress={() => setSelectedCategory(category)}
            >
              <Ionicons
                name={category === 'all' ? 'apps' : getCategoryIcon(category)}
                size={13}
                color={selectedCategory === category ? '#fff' : getCategoryColor(category)}
              />
              <Text style={{ color: selectedCategory === category ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                {category === 'all' ? 'All' : getCategoryLabel(category)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Create Post Button — community leaders only */}
        {isLeader && (
          <TouchableOpacity
            style={{ margin: 16, marginBottom: 8, backgroundColor: colors.accent, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="create" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create Community Post</Text>
          </TouchableOpacity>
        )}

        {/* Posts List */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadFeed} />}
        >
          {filteredPosts.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="newspaper-outline" size={60} color={colors.textLight} />
              <Text style={{ color: colors.textLight, marginTop: 10, textAlign: 'center' }}>
                No posts in your ward yet. Check back later for community updates.
              </Text>
            </View>
          ) : (
            filteredPosts.map((post) => {
              const isCrimeAlert = post.type === 'crime_alert';
              const isDeleting = deletingId === post.id;

              return (
                <View
                  key={post.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    elevation: isCrimeAlert ? 4 : 1,
                    borderLeftWidth: isCrimeAlert ? 4 : 0,
                    borderLeftColor: isCrimeAlert ? colors.error : 'transparent',
                    shadowColor: isCrimeAlert ? colors.error : '#000',
                    shadowOpacity: isCrimeAlert ? 0.15 : 0.05,
                    shadowRadius: isCrimeAlert ? 6 : 2,
                    shadowOffset: { width: 0, height: 2 },
                    opacity: isDeleting ? 0.5 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: getCategoryColor(post.type) + '20',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Ionicons name={getCategoryIcon(post.type)} size={20} color={getCategoryColor(post.type)} />
                    </View>

                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: getCategoryColor(post.type) }}>
                        {getCategoryLabel(post.type)}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textLight }}>
                        {post.createdByName} • {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Just now'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {post.priority === 'high' && (
                        <View style={{ backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>URGENT</Text>
                        </View>
                      )}

                      {isLeader && (
                        <TouchableOpacity
                          onPress={() => handleDeletePost(post)}
                          disabled={isDeleting}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: colors.error + '18',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          {isDeleting
                            ? <ActivityIndicator size="small" color={colors.error} />
                            : <Ionicons name="trash-outline" size={16} color={colors.error} />
                          }
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>
                    {post.title}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textLight, marginBottom: 12 }}>
                    {post.description}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="share-outline" size={18} color={colors.textLight} />
                      <Text style={{ fontSize: 12, color: colors.textLight }}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="bookmark-outline" size={18} color={colors.textLight} />
                      <Text style={{ fontSize: 12, color: colors.textLight }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Create Post Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: Platform.OS === 'ios' ? 36 : 24,
                maxHeight: '90%',
              }}>
                <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: colors.primary }}>Create Post</Text>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Category</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    {['crime_alert', 'emergency_notice', 'service_update'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor: newPost.type === type ? colors.accent : colors.background,
                          borderWidth: 1,
                          borderColor: newPost.type === type ? colors.accent : colors.border,
                        }}
                        onPress={() => setNewPost({ ...newPost, type })}
                      >
                        <Text style={{ textAlign: 'center', color: newPost.type === type ? '#fff' : colors.text, fontSize: 12 }}>
                          {getCategoryLabel(type)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Title</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Post title"
                    value={newPost.title}
                    onChangeText={(text) => setNewPost({ ...newPost, title: text })}
                    returnKeyType="next"
                  />

                  <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Description</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.border, minHeight: 100, textAlignVertical: 'top' }}
                    placeholder="Post content..."
                    multiline
                    value={newPost.description}
                    onChangeText={(text) => setNewPost({ ...newPost, description: text })}
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: colors.border, borderRadius: 8, padding: 12, alignItems: 'center' }}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={{ color: colors.text }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 8, padding: 12, alignItems: 'center' }}
                      onPress={handleCreatePost}
                      disabled={submitting}
                    >
                      {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Post</Text>}
                    </TouchableOpacity>
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