import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppColors, Spacing, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buscarPorCodigoPostal } from '@/lib/direccionMx';
import { buscarCalles } from '@/lib/mapboxAutocomplete';
import type { FotoEntrada } from '@/services/publicaciones.service';
import type { TipoPublicacion } from '@/types/database.types';
import { ThemedText } from './themed-text';

// AUD-27: el mismo tope que el CHECK de la tabla (migración 0010). Ambas capas,
// siempre: el cliente para avisar, la base para garantizar.
const MAX_FOTOS = 8;

const TIPOS: { valor: TipoPublicacion; etiqueta: string }[] = [
  { valor: 'depa', etiqueta: 'Departamento' },
  { valor: 'cuarto', etiqueta: 'Cuarto' },
  { valor: 'casa_compartida', etiqueta: 'Casa compartida' },
];

// Formulario de dirección estructurado (calle/número/colonia/...) en vez de un
// solo campo de texto libre — más fácil de llenar para quien publica, y produce
// una dirección mejor formada para el geocoding de Mapbox (menos ambigüedad).
const esquema = z.object({
  titulo: z.string().min(5, 'Escribe un título de al menos 5 caracteres').max(80, 'Máximo 80 caracteres'),
  tipo: z.enum(['depa', 'cuarto', 'casa_compartida']),
  calle: z.string().min(3, 'Escribe la calle'),
  numeroExterior: z.string().min(1, 'Escribe el número exterior'),
  numeroInterior: z.string().optional(),
  codigoPostal: z.string().regex(/^\d{5}$/, 'Código postal a 5 dígitos'),
  colonia: z.string().min(2, 'Escribe la colonia'),
  localidad: z.string().min(2, 'Escribe la localidad'),
  municipio: z.string().min(2, 'Escribe el municipio'),
  estado: z.string().min(2, 'Escribe el estado'),
  precioRenta: z
    .string()
    .min(1, 'Escribe el precio')
    .regex(/^\d+$/, 'Solo números')
    .refine((v) => Number(v) > 0, 'Debe ser mayor a 0'),
  descripcion: z.string().optional(),
  // Atributos EXPLÍCITOS, no adivinados con `descripcion.includes('mascota')`.
  // Esa heurística hacía que "NO acepto mascotas" contara como que sí, y un
  // filtro duro no se puede construir sobre eso (§11).
  permiteMascotas: z.boolean(),
  amueblado: z.boolean(),
  serviciosIncluidos: z.boolean(),
  recamaras: z
    .string()
    .regex(/^\d+$/, 'Solo números')
    .refine((v) => Number(v) > 0 && Number(v) <= 10, 'Entre 1 y 10'),
  // AUD-17: el formato de diez dígitos fija México. Mismo regex que el CHECK de
  // la tabla, para que las dos capas no puedan divergir.
  whatsapp: z.string().regex(/^\d{10}$/, 'Agrega un número a 10 dígitos'),
});

type FormPublicacion = z.infer<typeof esquema>;

// Forma externa que ya consumen publicacion/nueva.tsx y publicacion/editar/[id].tsx
// — se mantiene igual (un solo `direccion`) para no tener que tocar el servicio
// ni el geocoding; el armado de las partes a texto pasa aquí adentro.
export interface ValoresFormularioPublicacion {
  titulo: string;
  tipo: TipoPublicacion;
  direccion: string;
  precioRenta: string;
  descripcion?: string;
  permiteMascotas: boolean;
  amueblado: boolean;
  serviciosIncluidos: boolean;
  recamaras: string;
  whatsapp: string;
}

export interface DatosGuardarPublicacion extends ValoresFormularioPublicacion {
  fotos: FotoEntrada[];
}

interface Props {
  valoresIniciales?: Partial<ValoresFormularioPublicacion>;
  fotosIniciales?: string[];
  textoBoton: string;
  onGuardar: (datos: DatosGuardarPublicacion) => Promise<void>;
}

function armarDireccion(v: FormPublicacion): string {
  const numero = v.numeroInterior ? `${v.numeroExterior} Int. ${v.numeroInterior}` : v.numeroExterior;
  return `${v.calle} ${numero}, ${v.colonia}, ${v.localidad}, ${v.municipio}, ${v.estado}, CP ${v.codigoPostal}`;
}

interface CampoDesplegableProps {
  valor: string | undefined;
  onSeleccionar: (texto: string) => void;
  // Si se pasa, cada tecleo dentro del modal dispara una búsqueda externa
  // (async, ej. Mapbox) y `opciones` se toma tal cual venga — sin filtrar aquí
  // otra vez. Si no se pasa, `opciones` es una lista fija que sí se filtra
  // localmente conforme se escribe (ej. las colonias del código postal).
  onBuscar?: (texto: string) => void;
  opciones: string[];
  cargando?: boolean;
  titulo: string;
  placeholder: string;
  accessibilityLabel: string;
  estilo: (object | undefined)[];
  theme: ReturnType<typeof useTheme>;
  // false: sin buscador — solo despliega la lista fija tal cual, y agrega una
  // fila "Otra (escribir)" al final para texto libre (ej. Colonia: la lista ya
  // viene acotada por el código postal, un buscador ahí encima sería redundante).
  permiteBuscar?: boolean;
}

const OTRA_SENTINEL = '__otra__';

// Campo tipo "select": tocarlo despliega el menú justo debajo, en el mismo
// lugar (no una pantalla/modal aparte) — se cierra al tocar de nuevo el campo
// o al elegir una opción. Siempre se puede confirmar lo escrito aunque no esté
// en la lista (sección 17: nunca bloquear el flujo por datos que no cuadran exacto).
function CampoDesplegable({
  valor,
  onSeleccionar,
  onBuscar,
  opciones,
  cargando,
  titulo,
  placeholder,
  accessibilityLabel,
  estilo,
  theme,
  permiteBuscar = true,
}: CampoDesplegableProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [escribiendoLibre, setEscribiendoLibre] = useState(false);

  const alternar = () => {
    if (!abierto) setBusqueda(valor ?? '');
    setAbierto((v) => !v);
  };

  const onCambiaBusqueda = (texto: string) => {
    setBusqueda(texto);
    onBuscar?.(texto);
  };

  const onElegir = (texto: string) => {
    onSeleccionar(texto);
    setAbierto(false);
  };

  const volverALista = () => {
    setEscribiendoLibre(false);
    setBusqueda('');
    setAbierto(true);
  };

  if (escribiendoLibre) {
    return (
      <View style={styles.filaEscribirLibre}>
        <TextInput
          style={[...estilo, styles.inputEscribirLibre]}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={accessibilityLabel}
          autoFocus
          onChangeText={onSeleccionar}
          value={valor}
        />
        <Pressable
          onPress={volverALista}
          style={styles.botonVolverLista}
          accessibilityRole="button"
          accessibilityLabel={`Elegir ${titulo} de la lista`}
          hitSlop={8}
        >
          <Ionicons name="list" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
    );
  }

  const opcionesFiltradas =
    !permiteBuscar || onBuscar ? opciones : opciones.filter((o) => o.toLowerCase().includes(busqueda.trim().toLowerCase()));
  const coincideExacto = opcionesFiltradas.some((o) => o.toLowerCase() === busqueda.trim().toLowerCase());
  const datosLista = permiteBuscar
    ? busqueda.trim() && !coincideExacto
      ? [...opcionesFiltradas, `usar:${busqueda}`]
      : opcionesFiltradas
    : [...opcionesFiltradas, OTRA_SENTINEL];

  return (
    <View style={[styles.envolturaDesplegable, abierto && styles.envolturaDesplegableAbierta]}>
      <Pressable
        onPress={alternar}
        style={[...estilo, styles.campoDesplegable]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: abierto }}
      >
        <ThemedText style={!valor ? { color: theme.textSecondary } : undefined} numberOfLines={1}>
          {valor || placeholder}
        </ThemedText>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </Pressable>

      {abierto && (
        <View style={[styles.desplegable, { borderColor: theme.border, backgroundColor: theme.background }]}>
          {permiteBuscar && (
            <TextInput
              style={[styles.buscadorDesplegable, { borderColor: theme.border, color: theme.text }]}
              placeholder={`Buscar ${titulo.toLowerCase()}`}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={`Buscar ${accessibilityLabel}`}
              autoFocus
              onChangeText={onCambiaBusqueda}
              value={busqueda}
            />
          )}
          {cargando && <ActivityIndicator style={styles.cargandoSugerencias} size="small" />}

          <FlatList
            style={styles.listaDesplegable}
            data={datosLista}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={[styles.separadorDesplegable, { backgroundColor: theme.border }]} />}
            renderItem={({ item }) => {
              const esOtra = item === OTRA_SENTINEL;
              const esUsarTexto = item.startsWith('usar:');
              const texto = esUsarTexto ? item.slice(5) : item;
              return (
                <Pressable
                  onPress={() => (esOtra ? setEscribiendoLibre(true) : onElegir(texto))}
                  style={styles.filaMenu}
                  accessibilityRole="button"
                  accessibilityLabel={esOtra ? `Escribir ${titulo} manualmente` : esUsarTexto ? `Usar "${texto}"` : `Elegir ${texto}`}
                >
                  <ThemedText type="small" style={esOtra ? styles.textoOtra : undefined}>
                    {esOtra ? 'Otra (escribir)' : esUsarTexto ? `Usar "${texto}"` : texto}
                  </ThemedText>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <ThemedText type="small" style={styles.listaVacia}>
                Escribe para buscar
              </ThemedText>
            }
          />
        </View>
      )}
    </View>
  );
}

// Fila de fotos con miniaturas que se pueden quitar y placeholder para agregar
// más — misma UI tanto para crear (fotosIniciales vacío) como para editar.
export function FormularioPublicacion({ valoresIniciales, fotosIniciales = [], textoBoton, onGuardar }: Props) {
  const theme = useTheme();
  const [fotos, setFotos] = useState<FotoEntrada[]>(
    fotosIniciales.map((url) => ({ url, esNueva: false }))
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sugerenciasCalle, setSugerenciasCalle] = useState<string[]>([]);
  const [buscandoCalle, setBuscandoCalle] = useState(false);
  const temporizadorCalle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [opcionesColonia, setOpcionesColonia] = useState<string[]>([]);
  const [buscandoCP, setBuscandoCP] = useState(false);
  const [cpNoEncontrado, setCpNoEncontrado] = useState(false);
  const ultimoCPBuscado = useRef<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormPublicacion>({
    resolver: zodResolver(esquema),
    defaultValues: {
      titulo: valoresIniciales?.titulo,
      tipo: valoresIniciales?.tipo ?? 'depa',
      precioRenta: valoresIniciales?.precioRenta,
      descripcion: valoresIniciales?.descripcion,
      permiteMascotas: valoresIniciales?.permiteMascotas ?? false,
      amueblado: valoresIniciales?.amueblado ?? false,
      serviciosIncluidos: valoresIniciales?.serviciosIncluidos ?? false,
      recamaras: valoresIniciales?.recamaras ?? '1',
      whatsapp: valoresIniciales?.whatsapp,
    },
  });

  useEffect(() => {
    return () => {
      if (temporizadorCalle.current) clearTimeout(temporizadorCalle.current);
    };
  }, []);

  const onCambiaCalle = (texto: string) => {
    if (temporizadorCalle.current) clearTimeout(temporizadorCalle.current);
    if (texto.trim().length < 4) {
      setSugerenciasCalle([]);
      return;
    }
    temporizadorCalle.current = setTimeout(async () => {
      setBuscandoCalle(true);
      const resultados = await buscarCalles(texto);
      setSugerenciasCalle(resultados.map((r) => r.texto));
      setBuscandoCalle(false);
    }, 400);
  };

  const onCambiaCP = async (cp: string) => {
    if (!/^\d{5}$/.test(cp)) {
      setCpNoEncontrado(false);
      return;
    }
    if (cp === ultimoCPBuscado.current) return;
    ultimoCPBuscado.current = cp;
    setBuscandoCP(true);
    const datos = await buscarPorCodigoPostal(cp);
    setBuscandoCP(false);
    if (!datos) {
      setCpNoEncontrado(true);
      return;
    }
    setCpNoEncontrado(false);
    setOpcionesColonia(datos.colonias);
    // Solo rellena automático los campos que el usuario todavía no tocó — nunca
    // pisa algo que ya haya escrito a mano.
    if (!getValues('estado')) setValue('estado', datos.estado);
    if (!getValues('municipio')) setValue('municipio', datos.municipio);
    if (!getValues('localidad') && datos.localidad) setValue('localidad', datos.localidad);
  };

  const uriDeFoto = (foto: FotoEntrada) => (foto.esNueva ? foto.uri : foto.url);

  const onAgregarFotos = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError('Necesitamos permiso para acceder a tus fotos');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FOTOS - fotos.length,
      quality: 1,
    });
    if (resultado.canceled) return;
    const nuevas: FotoEntrada[] = resultado.assets.map((a) => ({ uri: a.uri, esNueva: true }));
    setFotos((prev) => [...prev, ...nuevas].slice(0, MAX_FOTOS));
  };

  const onQuitarFoto = (foto: FotoEntrada) => {
    setFotos((prev) => prev.filter((f) => uriDeFoto(f) !== uriDeFoto(foto)));
  };

  const onSubmit = async (valores: FormPublicacion) => {
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        titulo: valores.titulo,
        tipo: valores.tipo,
        direccion: armarDireccion(valores),
        precioRenta: valores.precioRenta,
        descripcion: valores.descripcion,
        permiteMascotas: valores.permiteMascotas,
        amueblado: valores.amueblado,
        serviciosIncluidos: valores.serviciosIncluidos,
        recamaras: valores.recamaras,
        whatsapp: valores.whatsapp,
        fotos,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la publicación');
    } finally {
      setEnviando(false);
    }
  };

  const estiloInput = [styles.input, { borderColor: theme.border, color: theme.text }];

  return (
    <View style={styles.container}>
      {valoresIniciales?.direccion && (
        <ThemedText type="small" style={styles.direccionActual}>
          Dirección actual: {valoresIniciales.direccion}
        </ThemedText>
      )}

      <Controller
        control={control}
        name="titulo"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Título (ej. Depa de 1 recámara a 10 min del campus)"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Título de la publicación"
            maxLength={80}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.titulo && <ThemedText style={styles.error}>{errors.titulo.message}</ThemedText>}

      <Controller
        control={control}
        name="tipo"
        render={({ field: { onChange, value } }) => (
          <View style={styles.filaTipos}>
            {TIPOS.map((tipo) => {
              const seleccionado = value === tipo.valor;
              return (
                <Pressable
                  key={tipo.valor}
                  onPress={() => onChange(tipo.valor)}
                  style={[
                    styles.pastillaTipo,
                    { borderColor: seleccionado ? AppColors.sello : theme.border },
                    seleccionado && { backgroundColor: AppColors.sello },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: seleccionado }}
                  accessibilityLabel={tipo.etiqueta}
                >
                  <ThemedText type="small" style={seleccionado ? styles.textoPastillaActiva : undefined}>
                    {tipo.etiqueta}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}
      />

      <ThemedText type="small" style={styles.etiqueta}>
        Dirección
      </ThemedText>
      <Controller
        control={control}
        name="calle"
        render={({ field: { onChange, value } }) => (
          <CampoDesplegable
            valor={value}
            onSeleccionar={(texto) => {
              onChange(texto);
              setSugerenciasCalle([]);
            }}
            onBuscar={onCambiaCalle}
            opciones={sugerenciasCalle}
            cargando={buscandoCalle}
            titulo="Calle"
            placeholder="Calle"
            accessibilityLabel="Calle"
            estilo={estiloInput}
            theme={theme}
          />
        )}
      />
      {errors.calle && <ThemedText style={styles.error}>{errors.calle.message}</ThemedText>}

      <View style={styles.filaDos}>
        <Controller
          control={control}
          name="numeroExterior"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[estiloInput, styles.inputMitad]}
              placeholder="Número exterior"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Número exterior"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="numeroInterior"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[estiloInput, styles.inputMitad]}
              placeholder="Número interior (opcional)"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Número interior, opcional"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
      </View>
      {errors.numeroExterior && <ThemedText style={styles.error}>{errors.numeroExterior.message}</ThemedText>}

      <Controller
        control={control}
        name="codigoPostal"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Código postal"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            maxLength={5}
            accessibilityLabel="Código postal"
            onBlur={onBlur}
            onChangeText={(texto) => {
              onChange(texto);
              onCambiaCP(texto);
            }}
            value={value}
          />
        )}
      />
      {buscandoCP && <ActivityIndicator style={styles.cargandoSugerencias} size="small" />}
      {cpNoEncontrado && (
        <ThemedText type="small" style={styles.avisoCpNoEncontrado}>
          No encontramos ese código postal — puedes llenar colonia/municipio/estado a mano.
        </ThemedText>
      )}
      {errors.codigoPostal && <ThemedText style={styles.error}>{errors.codigoPostal.message}</ThemedText>}

      <Controller
        control={control}
        name="colonia"
        render={({ field: { onChange, value } }) => (
          <CampoDesplegable
            valor={value}
            onSeleccionar={(texto) => {
              onChange(texto);
            }}
            opciones={opcionesColonia}
            titulo="Colonia"
            placeholder="Colonia"
            accessibilityLabel="Colonia"
            estilo={estiloInput}
            theme={theme}
            permiteBuscar={false}
          />
        )}
      />
      {errors.colonia && <ThemedText style={styles.error}>{errors.colonia.message}</ThemedText>}

      <Controller
        control={control}
        name="localidad"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Localidad"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Localidad"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.localidad && <ThemedText style={styles.error}>{errors.localidad.message}</ThemedText>}

      <View style={styles.filaDos}>
        <Controller
          control={control}
          name="municipio"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[estiloInput, styles.inputMitad]}
              placeholder="Municipio"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Municipio"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="estado"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[estiloInput, styles.inputMitad]}
              placeholder="Estado"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Estado"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
      </View>
      {errors.municipio && <ThemedText style={styles.error}>{errors.municipio.message}</ThemedText>}
      {errors.estado && <ThemedText style={styles.error}>{errors.estado.message}</ThemedText>}

      <ThemedText type="small" style={styles.etiqueta}>
        Detalles
      </ThemedText>
      <Controller
        control={control}
        name="precioRenta"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Precio de renta (MXN/mes)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            accessibilityLabel="Precio de renta mensual en pesos"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.precioRenta && <ThemedText style={styles.error}>{errors.precioRenta.message}</ThemedText>}

      <Controller
        control={control}
        name="descripcion"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[estiloInput, styles.descripcionInput]}
            placeholder="Descripción libre (qué tiene cerca, cómo es el ambiente...)"
            placeholderTextColor={theme.textSecondary}
            multiline
            accessibilityLabel="Descripción de la publicación"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />

      <Controller
        control={control}
        name="recamaras"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Número de recámaras"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            accessibilityLabel="Número de recámaras"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.recamaras && <ThemedText style={styles.error}>{errors.recamaras.message}</ThemedText>}

      <Controller
        control={control}
        name="permiteMascotas"
        render={({ field: { onChange, value } }) => (
          <View style={styles.filaSwitch}>
            <ThemedText>¿Permite mascotas?</ThemedText>
            <Switch value={value} onValueChange={onChange} accessibilityLabel="¿Permite mascotas?" />
          </View>
        )}
      />
      <Controller
        control={control}
        name="amueblado"
        render={({ field: { onChange, value } }) => (
          <View style={styles.filaSwitch}>
            <ThemedText>¿Está amueblado?</ThemedText>
            <Switch value={value} onValueChange={onChange} accessibilityLabel="¿Está amueblado?" />
          </View>
        )}
      />
      <Controller
        control={control}
        name="serviciosIncluidos"
        render={({ field: { onChange, value } }) => (
          <View style={styles.filaSwitch}>
            <ThemedText>¿Incluye servicios?</ThemedText>
            <Switch value={value} onValueChange={onChange} accessibilityLabel="¿Incluye servicios?" />
          </View>
        )}
      />

      <Controller
        control={control}
        name="whatsapp"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="WhatsApp (10 dígitos)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            accessibilityLabel="Número de WhatsApp, 10 dígitos"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.whatsapp && <ThemedText style={styles.error}>{errors.whatsapp.message}</ThemedText>}

      <ThemedText type="small" style={styles.etiqueta}>
        Fotos ({fotos.length}/{MAX_FOTOS})
      </ThemedText>
      <View style={styles.fotosFila}>
        {fotos.map((foto, indice) => (
          <View key={uriDeFoto(foto)} style={styles.fotoMiniContenedor}>
            <Image source={{ uri: uriDeFoto(foto) }} style={styles.fotoMini} contentFit="cover" />
            <Pressable
              onPress={() => onQuitarFoto(foto)}
              style={styles.fotoMiniQuitar}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Quitar foto ${indice + 1}`}
            >
              <Ionicons name="close" size={14} color={AppColors.selloTexto} />
            </Pressable>
          </View>
        ))}
        {fotos.length < MAX_FOTOS && (
          <Pressable
            onPress={onAgregarFotos}
            style={[styles.fotoMini, styles.fotoAgregar, { backgroundColor: theme.backgroundSelected }]}
            accessibilityRole="button"
            accessibilityLabel="Agregar foto"
          >
            <Ionicons name="add" size={28} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable
        style={styles.boton}
        onPress={handleSubmit(onSubmit)}
        disabled={enviando}
        accessibilityRole="button"
        accessibilityLabel={textoBoton}
        accessibilityState={{ disabled: enviando, busy: enviando }}
      >
        {enviando ? <ActivityIndicator color={AppColors.selloTexto} /> : <ThemedText style={styles.botonTexto}>{textoBoton}</ThemedText>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filaTipos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  pastillaTipo: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    minHeight: 36,
    justifyContent: 'center',
  },
  textoPastillaActiva: { color: AppColors.selloTexto, fontFamily: Tipografia.semibold },
  filaSwitch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    minHeight: 44,
  },
  container: { gap: Spacing.two },
  direccionActual: { fontStyle: 'italic', marginBottom: Spacing.one },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  inputMitad: { flex: 1 },
  filaDos: { flexDirection: 'row', gap: Spacing.two },
  descripcionInput: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: AppColors.destructiveRed },
  etiqueta: { marginTop: Spacing.two },
  cargandoSugerencias: { marginTop: Spacing.one, alignSelf: 'flex-start' },
  avisoCpNoEncontrado: { color: AppColors.destructiveRed },
  envolturaDesplegable: { position: 'relative', zIndex: 1 },
  envolturaDesplegableAbierta: { zIndex: 30, elevation: 30 },
  campoDesplegable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  desplegable: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.one,
    maxHeight: 260,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 30,
  },
  buscadorDesplegable: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    marginBottom: Spacing.one,
  },
  listaDesplegable: { maxHeight: 200 },
  separadorDesplegable: { height: 1 },
  listaVacia: { paddingVertical: Spacing.two, textAlign: 'center' },
  textoOtra: { fontStyle: 'italic' },
  filaEscribirLibre: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  inputEscribirLibre: { flex: 1 },
  botonVolverLista: { padding: Spacing.one },
  filaMenu: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  fotosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  fotoMiniContenedor: { position: 'relative' },
  fotoMini: { width: 80, height: 80, borderRadius: Spacing.two },
  fotoMiniQuitar: {
    position: 'absolute',
    top: -Spacing.half,
    right: -Spacing.half,
    backgroundColor: AppColors.destructiveRed,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoAgregar: { alignItems: 'center', justifyContent: 'center' },
  boton: {
    backgroundColor: AppColors.sello,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  botonTexto: { color: AppColors.selloTexto, fontFamily: Tipografia.semibold },
});
