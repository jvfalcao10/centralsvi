-- Cliente pode ler perfil, mas não criar. Estas funções deixam ele montar o
-- próprio radar sem receber escrita direta na tabela compartilhada de perfis.

CREATE OR REPLACE FUNCTION public.radar_add_profile(p_handle TEXT, p_reason TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_handle TEXT;
  v_client UUID;
  v_profile UUID;
  v_total INT;
BEGIN
  -- Aceita @perfil, perfil ou o endereço do perfil.
  v_handle := lower(trim(both from coalesce(p_handle, '')));
  v_handle := regexp_replace(v_handle, '^https?://(www\.)?instagram\.com/', '');
  v_handle := regexp_replace(v_handle, '/.*$', '');
  v_handle := ltrim(v_handle, '@');
  IF v_handle !~ '^[a-z0-9._]{1,30}$' OR v_handle IN ('p','reel','reels','explore','stories','tv') THEN
    RAISE EXCEPTION 'perfil invalido';
  END IF;

  v_client := public.current_client_id();
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'sem cliente associado';
  END IF;

  -- Teto por cliente: cada perfil vigiado custa coleta todo dia.
  SELECT count(*) INTO v_total FROM public.radar_watchlist WHERE client_id = v_client;
  IF v_total >= 8 THEN
    RAISE EXCEPTION 'limite de 8 perfis por cliente';
  END IF;

  INSERT INTO public.radar_profiles (platform, handle)
  VALUES ('instagram', v_handle)
  ON CONFLICT (platform, handle) DO NOTHING;

  SELECT id INTO v_profile FROM public.radar_profiles
  WHERE platform = 'instagram' AND handle = v_handle;

  INSERT INTO public.radar_watchlist (client_id, profile_id, reason, added_by)
  VALUES (v_client, v_profile, nullif(trim(both from coalesce(p_reason, '')), ''), auth.uid())
  ON CONFLICT (client_id, profile_id) DO NOTHING;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.radar_remove_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client UUID;
BEGIN
  v_client := public.current_client_id();
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'sem cliente associado';
  END IF;
  -- Sai só da lista deste cliente: o perfil continua servindo quem mais o vigia.
  DELETE FROM public.radar_watchlist WHERE client_id = v_client AND profile_id = p_profile_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.radar_add_profile(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.radar_remove_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.radar_add_profile(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.radar_remove_profile(UUID) TO authenticated;
