import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import type { Database } from '@/types/database.types';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? Constants.expoConfig?.extra?.supabaseAnonKey;

// Sin .env configurado, la app no debe crashear en pantalla blanca (sección 17
// del doc maestro) — index.tsx revisa `supabaseConfigurado` y muestra un aviso
// en vez de intentar cargar la sesión con credenciales inexistentes.
export const supabaseConfigurado = Boolean(supabaseUrl && supabaseAnonKey);

// `expo export`/`expo start --web` renderizan de forma estática en Node antes de
// llegar al navegador; ahí no existe `window` y el AsyncStorage web (que sí lo
// usa) truena el proceso entero. Sin storage/autoRefresh en ese entorno, el
// cliente igual se crea sin problema — la sesión real se carga ya en el navegador.
const enSSR = typeof window === 'undefined';

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      ...(enSSR ? {} : { storage: AsyncStorage }),
      autoRefreshToken: !enSSR,
      persistSession: !enSSR,
      detectSessionInUrl: false,
    },
  }
);
