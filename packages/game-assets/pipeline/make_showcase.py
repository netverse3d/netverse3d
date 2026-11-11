import json
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_kit import LIGHTMAP_UV, PALETTE_UV, ROWS, finish_lightmap_uv, prepare_lightmap_uv, select_objects

PLAN, STATION_BLEND, ROOM_BLEND, OUTPUT = sys.argv[sys.argv.index('--') + 1:]
SIZE = int(os.environ.get('SHOWCASE_SIZE', '2048'))
SPILL_SIZE = int(os.environ.get('SHOWCASE_SPILL_SIZE', '1024'))
SAMPLES = int(os.environ.get('SHOWCASE_SAMPLES', '96'))
EMIT = {'strip': (1.0, 0.0, 0.0), 'screen': (0.0, 1.0, 0.0), 'accent': (0.0, 0.0, 1.0)}
EMIT_STRENGTH = 12.0
WORLD_STRENGTH = 0.6
LAMP_ENERGY = 200.0
LAMP_HEIGHT = 3.42
CELL = 2.0
MARGIN = 8


def row_of(v):
    index = round((1.0 - v) * len(ROWS) - 0.5)
    return ROWS[max(0, min(len(ROWS) - 1, index))]


def append_templates(path, names):
    with bpy.data.libraries.load(path, link=False) as (source, target):
        target.objects = [name for name in names if name in source.objects]
    return {ob.name: ob for ob in target.objects if ob is not None}


def merge_materials(mesh):
    for index, material in enumerate(mesh.materials):
        base, _, suffix = material.name.rpartition('.')
        if suffix.isdigit() and base in bpy.data.materials:
            mesh.materials[index] = bpy.data.materials[base]


def place(collection, template, placement, name):
    mesh = template.data.copy()
    mesh.name = name
    merge_materials(mesh)
    ob = bpy.data.objects.new(name, mesh)
    x, y, z = placement['position']
    ob.location = (x, -z, y)
    ob.rotation_euler = (0.0, 0.0, placement['yaw'])
    collection.objects.link(ob)
    return ob


def tag_emitters(ob):
    mesh = ob.data
    attribute = mesh.color_attributes.new('bake_emit', 'FLOAT_COLOR', 'CORNER')
    uv = mesh.uv_layers[PALETTE_UV]
    for polygon in mesh.polygons:
        material = mesh.materials[polygon.material_index].name
        color = (0.0, 0.0, 0.0, 1.0)
        if material == 'glow':
            v = sum(uv.data[i].uv[1] for i in polygon.loop_indices) / len(polygon.loop_indices)
            color = (*EMIT.get(row_of(v), (0.0, 0.0, 0.0)), 1.0)
        elif material == 'display':
            color = (0.0, 1.0, 0.0, 1.0)
        for i in polygon.loop_indices:
            attribute.data[i].color = color


def bake_material(image):
    material = bpy.data.materials.new('bake')
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = tree.nodes.new('ShaderNodeOutputMaterial')
    add = tree.nodes.new('ShaderNodeAddShader')
    diffuse = tree.nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    emission = tree.nodes.new('ShaderNodeEmission')
    attribute = tree.nodes.new('ShaderNodeVertexColor')
    attribute.layer_name = 'bake_emit'
    target = tree.nodes.new('ShaderNodeTexImage')
    target.image = image
    tree.links.new(attribute.outputs['Color'], emission.inputs['Color'])
    tree.links.new(diffuse.outputs['BSDF'], add.inputs[0])
    tree.links.new(emission.outputs['Emission'], add.inputs[1])
    tree.links.new(add.outputs['Shader'], output.inputs['Surface'])
    tree.nodes.active = target
    return material, emission, target


def scene_image(name, black=False, size=SIZE):
    image = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    image.colorspace_settings.name = 'sRGB'
    if not black:
        import numpy
        image.pixels.foreach_set(numpy.ones(size * size * 4, dtype=numpy.float32))
    return image


def add_lamps(collection, cells):
    lamps = []
    width, depth = cells
    for ix in range(width):
        for iz in range(depth):
            data = bpy.data.lights.new('lamp_{}_{}'.format(ix, iz), 'AREA')
            data.energy = LAMP_ENERGY
            data.size = 1.4
            data.color = (1.0, 0.96, 0.9)
            ob = bpy.data.objects.new(data.name, data)
            ob.location = ((ix - (width - 1) / 2) * CELL, -(iz - (depth - 1) / 2) * CELL, LAMP_HEIGHT)
            collection.objects.link(ob)
            lamps.append(ob)
    return lamps


def configure_bake(scene):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = SAMPLES
    scene.cycles.max_bounces = 4
    scene.cycles.use_denoising = False
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.quality = 90
    bake = scene.render.bake
    bake.use_selected_to_active = False
    bake.use_clear = False
    bake.margin = MARGIN
    bake.use_pass_direct = True
    bake.use_pass_indirect = True
    bake.use_pass_color = False
    bake.use_pass_diffuse = True
    bake.use_pass_glossy = False
    bake.use_pass_transmission = False
    bake.use_pass_emit = False


def bake_pass(scene, objects, material, emission, target, image, lamps, lit):
    target.image = image
    emission.inputs['Strength'].default_value = 0.0 if lit else EMIT_STRENGTH
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = WORLD_STRENGTH if lit else 0.0
    for lamp in lamps:
        lamp.hide_render = not lit
    select_objects(objects)
    bpy.ops.object.bake(type='COMBINED', margin=MARGIN, use_clear=False)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    collection = scene.collection
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    scene.world = world
    plan = json.load(open(PLAN, encoding='utf-8'))
    placements = plan['room'] + plan['stations']
    wanted = sorted({item['part'] for item in placements})
    templates = append_templates(STATION_BLEND, wanted)
    templates.update(append_templates(ROOM_BLEND, [name for name in wanted if name not in templates]))
    objects = []
    for index, item in enumerate(placements):
        template = templates[item['part']]
        objects.append(place(collection, template, item, '{}_{:02d}'.format(item['part'], index)))
    for template in templates.values():
        bpy.data.objects.remove(template)
    prepare_lightmap_uv(objects)
    for ob in objects:
        tag_emitters(ob)
    originals = {ob.name: [slot.material for slot in ob.material_slots] for ob in objects}
    base = scene_image('showcase-base')
    spill = scene_image('showcase-spill', black=True, size=SPILL_SIZE)
    material, emission, target = bake_material(base)
    for ob in objects:
        for slot in ob.material_slots:
            slot.material = material
    lamps = add_lamps(collection, plan['cells'])
    configure_bake(scene)
    bake_pass(scene, objects, material, emission, target, base, lamps, lit=True)
    bake_pass(scene, objects, material, emission, target, spill, lamps, lit=False)
    for ob in objects:
        for slot, original in zip(ob.material_slots, originals[ob.name]):
            slot.material = original
    for lamp in lamps:
        data = lamp.data
        bpy.data.objects.remove(lamp)
        bpy.data.lights.remove(data)
    bpy.data.materials.remove(material)
    finish_lightmap_uv(objects)
    for image in (base, spill):
        image.use_fake_user = True
        image.pack()
    print('SHOWCASE', len(objects), 'objects', sum(len(ob.data.polygons) for ob in objects), 'polygons')
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT, compress=True)


main()
