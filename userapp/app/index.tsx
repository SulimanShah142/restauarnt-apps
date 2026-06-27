// Root - redirect to auth check (matches deliverapp pattern)
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/auth-check" />;
}
