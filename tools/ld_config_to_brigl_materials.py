#!/usr/bin/env python
"""
Create a brigl_materials.js file from a LDConfig.ldr (color) file.

Hazen 05/19
"""

def ldConfigToBrigl(ld_config, br_materials):

    # Load color data from LDConfig file.
    ldr_colors = {}

    with open(ld_config) as fp:
    
        for line in fp:
            parsed_line = list(filter(None, line.strip().split(" ")))
            if (len(parsed_line) < 3):
                continue

            if (parsed_line[0] == "0") and (parsed_line[1] == "!COLOUR"):
                name = parsed_line[2]
                code = parsed_line[4]
                value = parsed_line[6]
                edge = parsed_line[8]
                alpha = "255"
                if (len(parsed_line) > 9):
                    if (parsed_line[9] == "ALPHA"):
                        alpha = parsed_line[10]
                    
                color_data = {"value" : value[1:].lower(),
                              "edge" : edge[1:].lower(),
                              "alpha" : int(alpha)}
            
                ldr_colors[code] = color_data

    # Generate javascript file.
    mapping = []
    with open(br_materials, "w") as fp:
        fp.write("'use strict';\n")
        fp.write("\n")

        # Fill colors.
        fp.write("function BRIGL_MATERIALS() {\n")
        fp.write("\n")
        fp.write("  var BRIGL_MATERIALS = [\n")

        sorted_codes = sorted(ldr_colors, key = int)
        for i in range(len(sorted_codes)):
            mapping.append(sorted_codes[i])
            ldr_color = ldr_colors[sorted_codes[i]]
            
            fp.write("    new THREE.MeshPhongMaterial({\n")
            fp.write("        specular: 0x000000,\n")
            fp.write("        shininess: 100,\n")
            if (ldr_color["alpha"] != 255):
                opacity = "{0:.3f}".format(ldr_color["alpha"]/255.0)
                fp.write("        color: 0x" + ldr_color["value"] + ",\n")
                fp.write("        transparent: true,\n")
                fp.write("        opacity: " + opacity + "\n")
            else:
                fp.write("        color: 0x" + ldr_color["value"] + "\n")

            if (i == (len(sorted_codes)-1)):
                fp.write("    })\n")
            else:
                fp.write("    }),\n")
                
        fp.write("  ];\n")
        fp.write("  return BRIGL_MATERIALS;\n")
        fp.write("};\n")
        for i in range(2):
            fp.write("\n")

        # Edge colors.
        fp.write("function BRIGL_MATERIALS_EDGES() {\n")
        fp.write("\n")
        fp.write("  var BRIGL_MATERIALS_EDGES = [\n")

        for i in range(len(sorted_codes)):
            ldr_color = ldr_colors[sorted_codes[i]]
            
            fp.write("    new THREE.LineBasicMaterial({\n")
            fp.write("        linewidth: 2,\n")
            fp.write("        color: 0x" + ldr_color["edge"] + "\n")
            
            if (i == (len(sorted_codes)-1)):
                fp.write("    })\n")
            else:
                fp.write("    }),\n")
                
        fp.write("  ];\n")
        fp.write("  return BRIGL_MATERIALS_EDGES;\n")
        fp.write("};\n")
        for i in range(2):
            fp.write("\n")

        # Mapping.
        fp.write("var BRIGL_MATERIALS_MAPPING = {\n")
        for i in range(len(mapping)):
            if (i == (len(mapping)-1)):
                fp.write("    \"" + str(mapping[i]) + "\": " + str(i) + "\n")
            else:
                fp.write("    \"" + str(mapping[i]) + "\": " + str(i) + ",\n")

        fp.write("};\n")
        fp.write("\n")



if (__name__ == "__main__"):

    import argparse

    parser = argparse.ArgumentParser(description = 'Create a brigl_materials.js file from a LDConfig.ldr file')

    parser.add_argument('--ldconfig', dest='ldconfig', type=str, required=True,
                        help = "LDConfig.ldr file to use")
    parser.add_argument('--brigl_mat', dest='brigl_mat', type=str, required=False, default = 'brigl_materials.js',
                        help = "Name of output javascript file (default is 'brigl_materials.js')")

    args = parser.parse_args()
    
    ldConfigToBrigl(args.ldconfig, args.brigl_mat)

