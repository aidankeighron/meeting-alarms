import { useEffect, useState } from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  const [counter, setCounter] = useState<number>(0);
  
  useEffect(() => {
    setCounter(5)
  }, []);
    
  return (
    <View style={styles.container}>
      <Button title='Go Up' onPress={() => {
        setCounter(counter+1)
      }} />
      <Text style={{fontSize: 30, alignSelf: 'center'}}>{counter}</Text>
      <View style={styles.titleContainer}>
        <Text>Welcome!</Text>
      </View>
      <View style={styles.stepContainer}>
        <Text>Step 1: Try it</Text>
        <Text>
          Edit <Text>app/(tabs)/index.tsx</Text> to see changes.
          Press{' '}
          <Text>
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </Text>{' '}
          to open developer tools.
        </Text>
      </View>
      <View style={styles.stepContainer}>
        <Text>Step 2: Explore</Text>
        <Text>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </Text>
      </View>
      <View style={styles.stepContainer}>
        <Text>Step 3: Get a fresh start</Text>
        <Text>
          {`When you're ready, run `}
          <Text>npm run reset-project</Text> to get a fresh{' '}
          <Text>app</Text> directory. This will move the current{' '}
          <Text>app</Text> to{' '}
          <Text>app-example</Text>.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 20,
    marginTop: 40,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});