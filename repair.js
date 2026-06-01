const fs = require('fs');
const file = 'components/feed/components/FeedScreen.tsx';
let data = fs.readFileSync(file, 'utf8');

// The corrupted block starts here:
// <MaterialIcons name="nightlight-round" size={14} color="#EC4899" />
// </Text>
// {activeAstroEvent.ui_config?.cta ? (

const badPattern = /<MaterialIcons name="nightlight-round" size=\{14\} color="#EC4899" \/>\s*<\/Text>\s*\{activeAstroEvent\.ui_config\?\.cta \? \(/;

const goodReplacement = 
                        <MaterialIcons name="nightlight-round" size={14} color="#EC4899" />
                        <Text style={styles.zodiacChipTextSecondRef}>{profile.indian_sign || '—'}</Text>
                      </View>
                    </View>

                    {/* Compatibility Text */}
                    <View style={styles.compatibilityRefBlock}>
                      <Text style={styles.compatibilityRefText}>
                        <Text style={styles.compatibilityRefBold}>{profile.western_sign || 'Unknown'}</Text> • Sun sign compatibility with your sign.
                      </Text>
                      <TouchableOpacity onPress={() => { setCompProfile(profile); setShowCompatibilityModal(true); }}>
                        <Text style={styles.viewCompatibilityRefText}>View compatibility {'>'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Spacer for scrolling to trigger details - Reduced to bring card down */}
        <View style={{ height: 150 }} />
      </View>
    );
  };

  return (
    <ErrorBoundary>
    <View style={styles.screen}>
      {/* -- Dynamic Astro Event Banner ----------------------------------- */}
      {activeAstroEvent && (
        <LinearGradient
          colors={[
            activeAstroEvent.ui_config?.gradient_start ?? '#1a1a2e',
            activeAstroEvent.ui_config?.gradient_end   ?? '#e94560',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            marginHorizontal: 16,
            marginTop: 8,
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 18, marginRight: 8 }}>
            {activeAstroEvent.ui_config?.emoji ?? '?'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: activeAstroEvent.ui_config?.text_color ?? '#fff', fontWeight: '700', fontSize: 13 }}>
              {activeAstroEvent.ui_config?.banner_text ?? activeAstroEvent.event_name}
            </Text>
            {activeAstroEvent.ui_config?.cta ? (.trimStart();

if (data.match(badPattern)) {
    data = data.replace(badPattern, goodReplacement);
    fs.writeFileSync(file, data, 'utf8');
    console.log('Successfully repaired the file!');
} else {
    console.log('Pattern not found.');
}
