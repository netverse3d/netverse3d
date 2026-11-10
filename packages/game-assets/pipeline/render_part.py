import sys

import bpy
from mathutils import Vector

blend, part, out_prefix = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=blend)
scene = bpy.context.scene
target = bpy.data.objects[part]
for ob in bpy.data.objects:
    ob.hide_render = ob.type != 'MESH' or ob is not target
corners = [target.matrix_world @ Vector(c) for c in target.bound_box]
lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
size = hi - lo
centre = (lo + hi) / 2
print('SIZE', round(size.x, 3), round(size.y, 3), round(size.z, 3), 'tris', sum(len(p.vertices) - 2 for p in target.data.polygons))
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_cavity = True
scene.render.resolution_x = 900
scene.render.resolution_y = 760
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('World')
world.color = (0.12, 0.12, 0.14)
scene.world = world
for material, color in ((bpy.data.materials.get('surface'), (0.35, 0.3, 0.5, 1)), (bpy.data.materials.get('glow'), (0.8, 0.3, 1.0, 1))):
    if material:
        material.diffuse_color = color
camera_data = bpy.data.cameras.new('camera')
camera_data.lens = 50
camera = bpy.data.objects.new('camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
radius = max(size) * 2.1
views = {'front': (0, -1, 0.35), 'back': (0, 1, 0.35), 'side': (1, 0.15, 0.3), 'iso': (0.9, -0.9, 0.55)}
for name, direction in views.items():
    d = Vector(direction).normalized()
    camera.location = centre + d * radius
    camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = '{}-{}.png'.format(out_prefix, name)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)
