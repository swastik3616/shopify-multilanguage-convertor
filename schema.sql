--
-- PostgreSQL database dump
--

\restrict EhjbEdYdRCENtFDQH4lDyV0PCTiXewVhgwCxaANsKt1TZ0Ohrc17gCmxZMPXJhD

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_providers (
    id integer NOT NULL,
    provider_name character varying(50) NOT NULL,
    base_url character varying(255) NOT NULL,
    endpoint character varying(255) NOT NULL,
    method character varying(10) DEFAULT 'POST'::character varying NOT NULL,
    auth_type character varying(50) NOT NULL,
    auth_header character varying(100),
    api_key text,
    request_template text NOT NULL,
    response_mapping character varying(255) NOT NULL,
    headers text,
    model character varying(100),
    timeout integer DEFAULT 60,
    streaming_supported boolean DEFAULT false,
    is_active boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_providers OWNER TO postgres;

--
-- Name: ai_providers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_providers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_providers_id_seq OWNER TO postgres;

--
-- Name: ai_providers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_providers_id_seq OWNED BY public.ai_providers.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    id integer NOT NULL,
    key character varying(255) NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: app_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_settings_id_seq OWNER TO postgres;

--
-- Name: app_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    action character varying(255) NOT NULL,
    created_at timestamp without time zone
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: languages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.languages (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(10) NOT NULL,
    status character varying(20) DEFAULT 'None'::character varying
);


ALTER TABLE public.languages OWNER TO postgres;

--
-- Name: languages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.languages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.languages_id_seq OWNER TO postgres;

--
-- Name: languages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.languages_id_seq OWNED BY public.languages.id;


--
-- Name: overlay_edits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.overlay_edits (
    id integer NOT NULL,
    url character varying(500) NOT NULL,
    original_text text NOT NULL,
    new_text text NOT NULL,
    is_translation boolean,
    target_language character varying(100),
    selector character varying(1000),
    element_tag character varying(50),
    field_name character varying(100)
);


ALTER TABLE public.overlay_edits OWNER TO postgres;

--
-- Name: overlay_edits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.overlay_edits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.overlay_edits_id_seq OWNER TO postgres;

--
-- Name: overlay_edits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.overlay_edits_id_seq OWNED BY public.overlay_edits.id;


--
-- Name: page_contents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.page_contents (
    id integer NOT NULL,
    page character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    source_text text NOT NULL,
    html_tag character varying(50),
    section_id character varying(255),
    resource_id bigint
);


ALTER TABLE public.page_contents OWNER TO postgres;

--
-- Name: page_contents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.page_contents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.page_contents_id_seq OWNER TO postgres;

--
-- Name: page_contents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.page_contents_id_seq OWNED BY public.page_contents.id;


--
-- Name: provider_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_settings (
    id integer NOT NULL,
    provider character varying(50) NOT NULL,
    model character varying(100) NOT NULL,
    api_key text DEFAULT ''::text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.provider_settings OWNER TO postgres;

--
-- Name: provider_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.provider_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.provider_settings_id_seq OWNER TO postgres;

--
-- Name: provider_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.provider_settings_id_seq OWNED BY public.provider_settings.id;


--
-- Name: shopify_stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shopify_stores (
    id integer NOT NULL,
    shop character varying(255) NOT NULL,
    access_token text NOT NULL
);


ALTER TABLE public.shopify_stores OWNER TO postgres;

--
-- Name: shopify_stores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shopify_stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shopify_stores_id_seq OWNER TO postgres;

--
-- Name: shopify_stores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shopify_stores_id_seq OWNED BY public.shopify_stores.id;


--
-- Name: translations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.translations (
    id integer NOT NULL,
    source_text text NOT NULL,
    target_language character varying(100) NOT NULL,
    translated_text text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.translations OWNER TO postgres;

--
-- Name: translations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.translations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.translations_id_seq OWNER TO postgres;

--
-- Name: translations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.translations_id_seq OWNED BY public.translations.id;


--
-- Name: ai_providers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_providers ALTER COLUMN id SET DEFAULT nextval('public.ai_providers_id_seq'::regclass);


--
-- Name: app_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: languages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.languages ALTER COLUMN id SET DEFAULT nextval('public.languages_id_seq'::regclass);


--
-- Name: overlay_edits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overlay_edits ALTER COLUMN id SET DEFAULT nextval('public.overlay_edits_id_seq'::regclass);


--
-- Name: page_contents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.page_contents ALTER COLUMN id SET DEFAULT nextval('public.page_contents_id_seq'::regclass);


--
-- Name: provider_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_settings ALTER COLUMN id SET DEFAULT nextval('public.provider_settings_id_seq'::regclass);


--
-- Name: shopify_stores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopify_stores ALTER COLUMN id SET DEFAULT nextval('public.shopify_stores_id_seq'::regclass);


--
-- Name: translations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.translations ALTER COLUMN id SET DEFAULT nextval('public.translations_id_seq'::regclass);


--
-- Name: ai_providers ai_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_pkey PRIMARY KEY (id);


--
-- Name: ai_providers ai_providers_provider_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_provider_name_key UNIQUE (provider_name);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: languages languages_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_code_key UNIQUE (code);


--
-- Name: languages languages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_pkey PRIMARY KEY (id);


--
-- Name: overlay_edits overlay_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overlay_edits
    ADD CONSTRAINT overlay_edits_pkey PRIMARY KEY (id);


--
-- Name: page_contents page_contents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.page_contents
    ADD CONSTRAINT page_contents_pkey PRIMARY KEY (id);


--
-- Name: provider_settings provider_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_settings
    ADD CONSTRAINT provider_settings_pkey PRIMARY KEY (id);


--
-- Name: provider_settings provider_settings_provider_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_settings
    ADD CONSTRAINT provider_settings_provider_key UNIQUE (provider);


--
-- Name: shopify_stores shopify_stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopify_stores
    ADD CONSTRAINT shopify_stores_pkey PRIMARY KEY (id);


--
-- Name: translations translations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.translations
    ADD CONSTRAINT translations_pkey PRIMARY KEY (id);


--
-- Name: page_contents uq_page_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.page_contents
    ADD CONSTRAINT uq_page_key UNIQUE (page, key);


--
-- PostgreSQL database dump complete
--

\unrestrict EhjbEdYdRCENtFDQH4lDyV0PCTiXewVhgwCxaANsKt1TZ0Ohrc17gCmxZMPXJhD

