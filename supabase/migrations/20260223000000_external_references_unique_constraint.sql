alter table public.external_references
add constraint external_references_provider_entity_type_entity_id_key
unique (provider, entity_type, entity_id);
