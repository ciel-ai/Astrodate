const fs = require('fs');
let data = fs.readFileSync('app/profile-details/components/ProfileDetailsScreen.tsx', 'utf8');

data = data.replace(
  "import { hasFeature } from '@/lib/subscription';",
  "import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';"
);

data = data.replace(
  "export default function ProfileDetailsScreen() {",
  "export default function ProfileDetailsScreen() {\n  const { membership } = useSubscriptionStatus();\n  const isPremiumUser = membership?.features?.deep_synastry === true;"
);

data = data.replace(
  "  const [isPremiumUser, setIsPremiumUser] = useState(false);\n",
  ""
);

data = data.replace(
  "        const [synResult, premium] = await Promise.all([\n          getSynastryDetail(user.id, profile.id),\n          hasFeature('deep_synastry'),           // feature key from plan_catalog.features\n        ]);\n\n        if (synResult.success && synResult.data) {\n          setSynastryDetail(synResult.data);\n        }\n        setIsPremiumUser(premium);",
  "        const synResult = await getSynastryDetail(user.id, profile.id);\n\n        if (synResult.success && synResult.data) {\n          setSynastryDetail(synResult.data);\n        }"
);

fs.writeFileSync('app/profile-details/components/ProfileDetailsScreen.tsx', data);
