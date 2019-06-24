#!/usr/bin/env python
"""
Copies part files and sub-folders so that they can be used with brigl. The
specified directories should not include a final forward/backward slash.

Hazen 12/15
"""

import distutils
import distutils.dir_util
import os
import shutil
import sys

if (len(sys.argv) != 3):
    print("usage: <input directory> <output directory>")
    exit()

for elt in os.listdir(sys.argv[1]):
    out_dir = os.path.join(sys.argv[2], elt[0])
    if not os.path.exists(out_dir):
        os.mkdir(out_dir)

    print("Processing", elt, os.path.join(out_dir, elt)
    
    if os.path.isfile(os.path.join(sys.argv[1], elt)):
        shutil.copyfile(os.path.join(sys.argv[1], elt),
                        os.path.join(out_dir, elt))
    else:
        distutils.dir_util.copy_tree(os.path.join(sys.argv[1], elt),
                                     os.path.join(out_dir, elt))

