package brigl;

import java.awt.BorderLayout;
import java.awt.EventQueue;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JProgressBar;
import javax.swing.JTextField;
import javax.swing.UIManager;

public class MainWindow {

	private JFrame frmBriglPrepareParts;
	private JPanel panel;
	private JLabel lblBriglFolder;
	private JTextField ldrawFolder;
	private JTextField briglFolder;
	private JLabel lblFunction;
	private JButton startButton;
	private JProgressBar progressBar;
	private JLabel statusLabel;

	/**
	 * Launch the application.
	 */
	public static void main(String[] args) {
		EventQueue.invokeLater(new Runnable() {
			public void run() {
				try {
					UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
					MainWindow window = new MainWindow();
					window.frmBriglPrepareParts.setVisible(true);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		});
	}

	/**
	 * Create the application.
	 */
	public MainWindow() {
		initialize();
	}

	/**
	 * Initialize the contents of the frame.
	 */
	private void initialize() {
		frmBriglPrepareParts = new JFrame();
		frmBriglPrepareParts.setTitle("BRIGL Prepare Parts");
		frmBriglPrepareParts.setBounds(100, 100, 518, 300);
		frmBriglPrepareParts.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		frmBriglPrepareParts.getContentPane().setLayout(new BorderLayout(0, 0));
		
		panel = new JPanel();
		frmBriglPrepareParts.getContentPane().add(panel, BorderLayout.CENTER);
		panel.setLayout(null);
		
		JLabel lblLdrawFolder = new JLabel("LDraw folder");
		lblLdrawFolder.setBounds(25, 31, 71, 14);
		panel.add(lblLdrawFolder);
		
		lblBriglFolder = new JLabel("Brigl folder");
		lblBriglFolder.setBounds(25, 56, 71, 14);
		panel.add(lblBriglFolder);
		
		ldrawFolder = new JTextField();
		ldrawFolder.setBounds(123, 28, 318, 20);
		panel.add(ldrawFolder);
		ldrawFolder.setColumns(10);
		
		briglFolder = new JTextField();
		briglFolder.setColumns(10);
		briglFolder.setBounds(123, 53, 318, 20);
		panel.add(briglFolder);
		
		lblFunction = new JLabel("<html>This tool will prepare the <b>parts</b> folder in brigl. Each part will be copied from LDraw and put on the correct subfolder. No modifications will be made on LDRaw folder.\r\nYou can run this program again, but you should delete the content of brigl/parts folder beforehand.\r\n</html>");
		lblFunction.setBounds(25, 81, 464, 89);
		panel.add(lblFunction);
		
		progressBar = new JProgressBar();
		progressBar.setBounds(25, 228, 464, 16);
		panel.add(progressBar);
		
		startButton = new JButton("Start");
		startButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				start();
			}
		});
		startButton.setBounds(25, 176, 464, 23);
		panel.add(startButton);
		
		statusLabel = new JLabel("Ready.");
		statusLabel.setBounds(25, 203, 343, 14);
		panel.add(statusLabel);
		
		JButton button = new JButton("...");
		button.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				pickFolder(briglFolder);
			}
		});
		
		button.setBounds(442, 53, 47, 20);
		panel.add(button);
		
		JButton button_1 = new JButton("...");
		button_1.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				pickFolder(ldrawFolder);
			}
		});
		button_1.setBounds(442, 28, 47, 20);
		panel.add(button_1);
	}

	protected void start() {
		String check = PrepareParts.check(briglFolder.getText(), ldrawFolder.getText());
	    if(check!=null)
	    {
	    	JOptionPane.showMessageDialog(null, check);
	    	return;
	    }
		
		startButton.setEnabled(false);
		statusLabel.setText("Checking");
	}

	protected void pickFolder(JTextField text) {
		JFileChooser chooser = new JFileChooser();
	    chooser.setCurrentDirectory(new java.io.File("."));
	    chooser.setDialogTitle("Select your folder");
	    chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
	    chooser.setAcceptAllFileFilterUsed(false);

	    if (chooser.showOpenDialog(null) == JFileChooser.APPROVE_OPTION) {
	      text.setText(chooser.getSelectedFile().getAbsolutePath());
	    }
		
	}
	public JButton getStartButton() {
		return startButton;
	}
	public JProgressBar getProgressBar() {
		return progressBar;
	}
	public JLabel getStatusLabel() {
		return statusLabel;
	}
}
