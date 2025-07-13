import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();


const CLIENT_ID = '1024434201907-k7dhskjs52prefjmsuv1omf2um1gfqev.apps.googleusercontent.com';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export default function HomeScreen() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      redirectUri: 'https://auth.expo.io/@anonymous/meeting-alarms',
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success' && response.authentication) {
      setAccessToken(response.authentication.accessToken ?? null);
    }
  }, [response]);

  async function fetchCalendarEvents() {
    if (!accessToken) return;
    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const data = await res.json();
      setEvents(data.items || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Button
        title="Sign in with Google"
        disabled={!request}
        onPress={() => promptAsync()}
      />

      {accessToken && (
        <Button title="Get My Calendar Events" onPress={fetchCalendarEvents} />
      )}

      {events.length > 0 && (
        <View>
          <Text style={styles.heading}>Upcoming Events:</Text>
          {events.map((event, index) => (
            <View key={index} style={styles.event}>
              <Text style={styles.summary}>{event.summary ?? 'No Title'}</Text>
              <Text>
                Start:{' '}
                {event.start?.dateTime ?? event.start?.date ?? 'Unknown start'}
              </Text>
              <Text>
                End: {event.end?.dateTime ?? event.end?.date ?? 'Unknown end'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 20,
    marginTop: 40,
  },
  heading: {
    fontSize: 20,
    marginTop: 20,
    fontWeight: 'bold',
  },
  event: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#eee',
    borderRadius: 10,
  },
  summary: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});
