import json
import os

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(ROOT, 'source')
EXPORT_DIR = os.path.join(ROOT, 'exported')
with open(os.path.join(ROOT, 'assets.config.json'), encoding='utf-8') as handle:
    CONFIG = json.load(handle)

NODE_BASE_PROPERTIES = {item.identifier for item in bpy.types.Node.bl_rna.properties}
GLTF_OPTIONS = {
    'export_format': 'GLB',
    'use_selection': True,
    'export_apply': False,
    'export_yup': True,
    'export_morph': False,
    'export_texcoords': True,
    'export_image_format': 'JPEG',
    'export_jpeg_quality': 90,
    'export_vertex_color': 'NAME',
    'export_vertex_color_name': 'Col',
    'export_all_vertex_colors': False,
}


def require_blender_version():
    required = tuple(CONFIG['blenderVersion'])
    if bpy.app.version[:2] < required:
        raise SystemExit('Blender {}.{} or newer is required'.format(*required))


def reject_unapplied_modifiers(ob, filename):
    unapplied = [modifier.name for modifier in ob.modifiers if modifier.type != 'ARMATURE']
    if unapplied:
        raise SystemExit('{} in {} has unapplied modifiers: {}'.format(ob.name, filename, ', '.join(unapplied)))


def append_objects(filename, names=None):
    path = os.path.join(SOURCE_DIR, filename)
    with bpy.data.libraries.load(path, link=False) as (source, target):
        wanted = list(source.objects) if names is None else list(names)
        missing = [name for name in wanted if name not in source.objects]
        if missing:
            raise SystemExit('{} is missing objects: {}'.format(filename, ', '.join(missing)))
        target.objects = wanted
    for ob in target.objects:
        reject_unapplied_modifiers(ob, filename)
        bpy.context.scene.collection.objects.link(ob)
    return list(target.objects)


def append_actions(filename):
    path = os.path.join(SOURCE_DIR, filename)
    with bpy.data.libraries.load(path, link=False) as (source, target):
        target.actions = list(source.actions)


def bind_to_rig(ob, rig):
    ob.parent = rig
    for modifier in ob.modifiers:
        if modifier.type == 'ARMATURE':
            modifier.object = rig


def remove_extra_rigs(rig):
    for ob in list(bpy.data.objects):
        if ob.type == 'ARMATURE' and ob is not rig:
            bpy.data.objects.remove(ob)


def comparable(value):
    if isinstance(value, float):
        return round(value, 4)
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, bpy.types.ID):
        return value.name.rpartition('.')[0] if value.name.rpartition('.')[2].isdigit() else value.name
    if hasattr(value, '__len__'):
        return tuple(comparable(item) for item in value)
    return type(value).__name__


def node_settings(node):
    return [
        (item.identifier, comparable(getattr(node, item.identifier)))
        for item in node.bl_rna.properties
        if item.identifier not in NODE_BASE_PROPERTIES and item.type != 'COLLECTION'
    ]


def unlinked_inputs(node):
    return [
        (socket.name, comparable(getattr(socket, 'default_value', None)))
        for socket in node.inputs
        if not socket.is_linked
    ]


def material_signature(material):
    tree = material.node_tree
    nodes = sorted(tree.nodes, key=lambda node: node.name) if tree else []
    links = sorted((l.from_node.name, l.from_socket.name, l.to_node.name, l.to_socket.name) for l in tree.links) if tree else []
    described = [(node.name, node.bl_idname, node_settings(node), unlinked_inputs(node)) for node in nodes]
    return comparable(material.diffuse_color), described, links


def merge_duplicate_materials(meshes):
    for ob in meshes:
        for slot in ob.material_slots:
            if slot.material is None:
                continue
            base, _, suffix = slot.material.name.rpartition('.')
            if suffix.isdigit() and base in bpy.data.materials:
                original = bpy.data.materials[base]
                if material_signature(slot.material) != material_signature(original):
                    raise SystemExit('Material {} differs between source files: change it in every file'.format(base))
                slot.material = original


def select_only(objects, active):
    for ob in bpy.context.view_layer.objects:
        ob.select_set(ob in objects)
    bpy.context.view_layer.objects.active = active


def triangles(ob):
    return sum(len(polygon.vertices) - 2 for polygon in ob.data.polygons)


def attach_first_clip(rig):
    animation = rig.animation_data_create()
    animation.action = bpy.data.actions[CONFIG['clips'][0]]
    animation.action_slot = animation.action_suitable_slots[0]


def assemble_character():
    character = CONFIG['character']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig = append_objects(character['rigSource'], [CONFIG['rig']])[0]
    meshes = {}
    for name, spec in character['meshes'].items():
        meshes[name] = append_objects(spec['source'], [name])[0]
        bind_to_rig(meshes[name], rig)
    remove_extra_rigs(rig)
    merge_duplicate_materials(meshes.values())
    append_actions(character['clipSource'])
    attach_first_clip(rig)
    return rig, meshes


def decimate(ob, target):
    select_only([ob], ob)
    modifier = ob.modifiers.new('reduce', 'DECIMATE')
    modifier.ratio = target / triangles(ob)
    bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def export_character():
    character = CONFIG['character']
    rig, meshes = assemble_character()
    select_only(list(meshes.values()) + [rig], rig)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(EXPORT_DIR, character['file']),
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_skins=True,
        export_frame_step=1,
        **GLTF_OPTIONS,
    )
    print('EXPORTED', character['file'], {name: triangles(ob) for name, ob in meshes.items()}, len(bpy.data.actions), 'clips')
    for name, spec in character['meshes'].items():
        if 'lodTriangles' in spec:
            decimate(meshes[name], spec['lodTriangles'])
    select_only(list(meshes.values()) + [rig], rig)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(EXPORT_DIR, character['lodFile']),
        export_animations=False,
        export_skins=True,
        **GLTF_OPTIONS,
    )
    print('EXPORTED', character['lodFile'], {name: triangles(ob) for name, ob in meshes.items()})


def export_prop(prop):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ob = append_objects(prop['source'], [prop['object']])[0]
    select_only([ob], ob)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(EXPORT_DIR, prop['file']),
        export_animations=False,
        **GLTF_OPTIONS,
    )
    print('EXPORTED', prop['file'], triangles(ob))


def export_scene(scene):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objects = append_objects(scene['source'])
    bpy.context.view_layer.update()
    meshes = [ob for ob in objects if ob.type == 'MESH']
    select_only(meshes, meshes[0])
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(EXPORT_DIR, scene['file']),
        export_animations=False,
        **GLTF_OPTIONS,
    )
    path = os.path.join(SOURCE_DIR, scene['source'])
    with bpy.data.libraries.load(path, link=False) as (source, target):
        target.images = [name for name in scene['images'].values() if name in source.images]
    bpy.context.scene.render.image_settings.quality = 90
    for key, name in scene['images'].items():
        image = bpy.data.images[name]
        image.filepath_raw = os.path.join(EXPORT_DIR, scene['files'][key])
        image.file_format = 'JPEG'
        image.save()
    print('EXPORTED', scene['file'], sum(triangles(ob) for ob in meshes), 'images', ', '.join(scene['files'].values()))


def export_kit(kit):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objects = append_objects(kit['source'])
    bpy.context.view_layer.update()
    select_only(objects, objects[0])
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(EXPORT_DIR, kit['file']),
        export_animations=False,
        **GLTF_OPTIONS,
    )
    print('EXPORTED', kit['file'], sum(triangles(ob) for ob in objects if ob.type == 'MESH'))


require_blender_version()
export_character()
for item in CONFIG['props']:
    export_prop(item)
for item in CONFIG.get('kits', []):
    export_kit(item)
for item in CONFIG.get('scenes', []):
    export_scene(item)
