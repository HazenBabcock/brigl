#!/usr/bin/env python
"""
Copies part files and sub-folders so that they can be used with brigl. The
specified directories should not include a final forward/backward slash.

Hazen 12/15
"""

import os
import shutil
import sys

if (len(sys.argv) != 3):
    print "usage: <input directory> <output directory>"
    exit()
    
for elt in os.listdir(sys.argv[1]):
    out_dir = sys.argv[2] + os.path.sep + elt[0]
    if not os.path.exists(out_dir):
        os.mkdir(out_dir)

    print "Processing", elt
    
    if os.path.isfile(sys.argv[1] + os.path.sep + elt):
        shutil.copyfile(sys.argv[1] + os.path.sep + elt,
                        out_dir + os.path.sep + elt)
    else:
        shutil.copytree(sys.argv[1] + os.path.sep + elt,
                        out_dir + os.path.sep + elt)

