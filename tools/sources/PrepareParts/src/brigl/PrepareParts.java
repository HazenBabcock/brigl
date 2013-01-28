package brigl;

import java.io.File;

public class PrepareParts {

	
	
	public static String check(String briglFolder, String ldrawFolder)
	{
		File b = new File(briglFolder);
		File l = new File(ldrawFolder);
		
		if(!b.exists()) return "Brigl folder does not exists";
		if(!l.exists()) return "LDraw folder does not exists";
		
		boolean briglOk = new File(b, "tools").exists() && new File(b, "web").exists()
				 && new File(b, "web"+File.separator+"parts").exists();
		
		if(!briglOk) return "Brigl folder doesn't appear to be correct. It should contain 'web' and 'tools' subfolders.";
		
		boolean ldrawOk = new File(l, "parts").exists() && new File(l, "p").exists();
		
		if(!ldrawOk) return "LDraw folder doesn't appear to be correct. It should contain 'parts' and 'p' subfolders.";
		
		return null;
	}

}
