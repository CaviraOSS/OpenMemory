const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

class ComputerFundamentalsPPT {
    constructor() {
        this.doc = new PDFDocument({ size: 'A4', margin: 50 });
        this.outputPath = path.join(__dirname, 'Computer_Fundamentals_Presentation.pdf');
        this.currentPage = 1;
        
        // Colors
        this.primaryColor = '#2C3E50';
        this.accentColor = '#3498DB';
        this.textColor = '#34495E';
    }

    async generate() {
        console.log('Starting PDF generation...');
        
        // Create write stream
        this.doc.pipe(fs.createWriteStream(this.outputPath));

        // Title Page
        this.addTitlePage();
        
        // Practical 1
        this.addNewPage();
        this.addPractical1();
        
        // Practical 2
        this.addNewPage();
        this.addPractical2();
        
        // Practical 3
        this.addNewPage();
        this.addPractical3();

        // Finalize PDF
        this.doc.end();
        
        console.log(`PDF generated successfully: ${this.outputPath}`);
    }

    addTitlePage() {
        // Background rectangle
        this.doc.rect(0, 0, 595, 842).fill('#2C3E50');
        
        // Title
        this.doc.fontSize(40)
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .text('COMPUTER', 50, 250, { align: 'center' })
            .text('FUNDAMENTALS', 50, 300, { align: 'center' });
        
        // Subtitle
        this.doc.fontSize(20)
            .fillColor('#3498DB')
            .font('Helvetica')
            .text('Practical Guide', 50, 380, { align: 'center' });
        
        // Footer
        this.doc.fontSize(12)
            .fillColor('#BDC3C7')
            .text('Introduction to Computer Science', 50, 700, { align: 'center' });
    }

    addNewPage() {
        this.doc.addPage();
        this.currentPage++;
    }

    addHeader(title, practicalNumber) {
        // Header background
        this.doc.rect(0, 0, 595, 80).fill(this.accentColor);
        
        // Practical number
        this.doc.fontSize(14)
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .text(`PRACTICAL - ${practicalNumber}`, 50, 25);
        
        // Title
        this.doc.fontSize(18)
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .text(title, 50, 45, { width: 495 });
    }

    addSection(title, content, yPosition) {
        this.doc.fontSize(14)
            .fillColor(this.primaryColor)
            .font('Helvetica-Bold')
            .text(title, 50, yPosition);
        
        this.doc.fontSize(11)
            .fillColor(this.textColor)
            .font('Helvetica')
            .text(content, 50, yPosition + 25, { width: 495, align: 'justify' });
        
        return yPosition + 25 + this.doc.heightOfString(content, { width: 495 }) + 15;
    }

    addBulletPoints(points, yPosition) {
        points.forEach((point, index) => {
            this.doc.fontSize(11)
                .fillColor(this.textColor)
                .font('Helvetica')
                .text('•', 60, yPosition)
                .text(point, 80, yPosition, { width: 465, align: 'justify' });
            
            yPosition += this.doc.heightOfString(point, { width: 465 }) + 8;
        });
        
        return yPosition + 10;
    }

    addImagePlaceholder(label, yPosition, height = 150) {
        // Create a simple visual representation
        this.doc.rect(50, yPosition, 495, height)
            .fillAndStroke('#ECF0F1', '#BDC3C7');
        
        this.doc.fontSize(12)
            .fillColor('#7F8C8D')
            .font('Helvetica-Oblique')
            .text(label, 50, yPosition + height/2 - 10, { width: 495, align: 'center' });
        
        return yPosition + height + 20;
    }

    addPractical1() {
        this.addHeader('Introduction to Computer and Its Organization', 1);
        
        let y = 100;
        
        // Definition
        y = this.addSection(
            'What is a Computer?',
            'A computer is an electronic device that accepts data as input, processes it according to a set of instructions (program), stores the data, and produces output in a desired format. It can perform arithmetic and logical operations at high speed and with great accuracy.',
            y
        );
        
        // Computer diagram placeholder
        y = this.addImagePlaceholder('[ Computer System Block Diagram ]', y, 120);
        
        // Organization
        y = this.addSection(
            'Computer Organization',
            'Computer organization refers to the operational units and their interconnections that realize the architectural specifications. The main components include:',
            y
        );
        
        const orgPoints = [
            'Input Unit: Accepts data and instructions from the user',
            'Central Processing Unit (CPU): Processes data and controls operations',
            'Memory Unit: Stores data and instructions temporarily or permanently',
            'Output Unit: Presents processed data to the user',
            'Control Unit: Manages and coordinates all computer operations'
        ];
        
        y = this.addBulletPoints(orgPoints, y);
        
        // New page for characteristics
        this.addNewPage();
        this.addHeader('Computer Characteristics', 1);
        
        y = 100;
        
        const characteristics = [
            {
                title: 'Speed',
                desc: 'Computers can process millions of instructions per second (MIPS). Modern computers operate at speeds measured in gigahertz (GHz).'
            },
            {
                title: 'Accuracy',
                desc: 'Computers perform calculations with 100% accuracy. Errors occur only due to incorrect input or faulty programming.'
            },
            {
                title: 'Diligence',
                desc: 'Unlike humans, computers can work continuously without fatigue, maintaining the same level of accuracy and speed.'
            },
            {
                title: 'Versatility',
                desc: 'Computers can perform various tasks simultaneously, from simple calculations to complex scientific simulations.'
            },
            {
                title: 'Storage Capacity',
                desc: 'Computers can store vast amounts of data in a very small physical space, measured in gigabytes (GB) or terabytes (TB).'
            },
            {
                title: 'Automation',
                desc: 'Once programmed, computers can automatically execute tasks without human intervention.'
            }
        ];
        
        characteristics.forEach(char => {
            y = this.addSection(char.title, char.desc, y);
        });
    }

    addPractical2() {
        this.addHeader('Classification and Generations of Computers', 2);
        
        let y = 100;
        
        // Classification
        y = this.addSection(
            'Classification of Computers',
            'Computers can be classified based on size, purpose, and data handling capabilities:',
            y
        );
        
        const classifications = [
            'Supercomputers: Most powerful, used for complex scientific calculations',
            'Mainframe Computers: Large systems for bulk data processing',
            'Mini Computers: Mid-sized, multi-user systems',
            'Workstations: High-performance single-user computers',
            'Microcomputers (PCs): Personal computers for individual use',
            'Embedded Computers: Specialized computers in devices'
        ];
        
        y = this.addBulletPoints(classifications, y);
        
        y = this.addImagePlaceholder('[ Computer Classification Hierarchy ]', y, 100);
        
        // New page for generations
        this.addNewPage();
        this.addHeader('Generations of Computers', 2);
        
        y = 100;
        
        const generations = [
            {
                title: 'First Generation (1940-1956): Vacuum Tubes',
                points: [
                    'Used vacuum tubes for circuitry and magnetic drums for memory',
                    'Very large in size, consumed lots of electricity',
                    'Generated excessive heat and frequent failures',
                    'Examples: ENIAC, UNIVAC, EDVAC'
                ]
            },
            {
                title: 'Second Generation (1956-1963): Transistors',
                points: [
                    'Transistors replaced vacuum tubes',
                    'Smaller, faster, cheaper, and more energy-efficient',
                    'Used assembly language and high-level languages',
                    'Examples: IBM 1401, CDC 1604'
                ]
            },
            {
                title: 'Third Generation (1964-1971): Integrated Circuits',
                points: [
                    'Used Integrated Circuits (ICs) with multiple transistors',
                    'Significantly smaller and more reliable',
                    'Introduction of keyboards and monitors',
                    'Examples: IBM 360 series, PDP-8'
                ]
            },
            {
                title: 'Fourth Generation (1971-Present): Microprocessors',
                points: [
                    'Microprocessors with thousands of ICs on a single chip',
                    'Development of personal computers (PCs)',
                    'GUI, mouse, and networking capabilities',
                    'Examples: Intel 4004, IBM PC, Apple Macintosh'
                ]
            },
            {
                title: 'Fifth Generation (Present-Future): AI',
                points: [
                    'Based on Artificial Intelligence and parallel processing',
                    'Voice recognition, natural language processing',
                    'Quantum computing and neural networks',
                    'Examples: AI systems, quantum computers'
                ]
            }
        ];
        
        generations.forEach(gen => {
            if (y > 650) {
                this.addNewPage();
                this.addHeader('Generations of Computers (Continued)', 2);
                y = 100;
            }
            
            this.doc.fontSize(12)
                .fillColor(this.primaryColor)
                .font('Helvetica-Bold')
                .text(gen.title, 50, y);
            
            y += 20;
            y = this.addBulletPoints(gen.points, y);
        });
    }

    addPractical3() {
        this.addHeader('Input and Output Devices of Computer', 3);
        
        let y = 100;
        
        // Input Devices
        y = this.addSection(
            'Input Devices',
            'Input devices are hardware components used to provide data and control signals to a computer system:',
            y
        );
        
        const inputDevices = [
            {
                name: 'Keyboard',
                desc: 'Primary text input device with alphanumeric keys, function keys, and special keys'
            },
            {
                name: 'Mouse',
                desc: 'Pointing device used to interact with graphical user interfaces through clicking and dragging'
            },
            {
                name: 'Scanner',
                desc: 'Converts physical documents and images into digital format'
            },
            {
                name: 'Microphone',
                desc: 'Captures audio input for voice commands, recording, and communication'
            },
            {
                name: 'Webcam',
                desc: 'Captures video input for video conferencing and recording'
            },
            {
                name: 'Touchscreen',
                desc: 'Combined input/output device allowing direct interaction with display'
            },
            {
                name: 'Joystick/Gamepad',
                desc: 'Gaming input devices for controlling movement and actions'
            }
        ];
        
        inputDevices.forEach(device => {
            if (y > 700) {
                this.addNewPage();
                this.addHeader('Input Devices (Continued)', 3);
                y = 100;
            }
            
            this.doc.fontSize(11)
                .fillColor(this.primaryColor)
                .font('Helvetica-Bold')
                .text(`• ${device.name}:`, 60, y);
            
            this.doc.fontSize(10)
                .fillColor(this.textColor)
                .font('Helvetica')
                .text(device.desc, 80, y + 15, { width: 465 });
            
            y += 45;
        });
        
        y = this.addImagePlaceholder('[ Common Input Devices ]', y, 120);
        
        // New page for output devices
        this.addNewPage();
        this.addHeader('Output Devices', 3);
        
        y = 100;
        
        y = this.addSection(
            'Output Devices',
            'Output devices are hardware components that receive data from a computer and present it to the user:',
            y
        );
        
        const outputDevices = [
            {
                name: 'Monitor/Display',
                desc: 'Visual output device showing text, images, and video. Types include LCD, LED, OLED'
            },
            {
                name: 'Printer',
                desc: 'Produces hard copy output on paper. Types: Inkjet, Laser, Dot Matrix, 3D printers'
            },
            {
                name: 'Speakers',
                desc: 'Audio output devices for playing sounds, music, and voice'
            },
            {
                name: 'Headphones',
                desc: 'Personal audio output devices worn on or in the ears'
            },
            {
                name: 'Projector',
                desc: 'Displays computer output on large screens or walls for presentations'
            },
            {
                name: 'Plotter',
                desc: 'Specialized printer for producing large-scale graphics and engineering drawings'
            }
        ];
        
        outputDevices.forEach(device => {
            if (y > 700) {
                this.addNewPage();
                this.addHeader('Output Devices (Continued)', 3);
                y = 100;
            }
            
            this.doc.fontSize(11)
                .fillColor(this.primaryColor)
                .font('Helvetica-Bold')
                .text(`• ${device.name}:`, 60, y);
            
            this.doc.fontSize(10)
                .fillColor(this.textColor)
                .font('Helvetica')
                .text(device.desc, 80, y + 15, { width: 465 });
            
            y += 45;
        });
        
        y = this.addImagePlaceholder('[ Common Output Devices ]', y, 120);
        
        // Add comparison section
        if (y > 600) {
            this.addNewPage();
            this.addHeader('Input vs Output Devices', 3);
            y = 100;
        }
        
        y = this.addSection(
            'Key Differences',
            'Input devices send data TO the computer, while output devices receive data FROM the computer. Some devices like touchscreens and network cards can function as both input and output devices.',
            y
        );
    }
}

// Generate the PDF
const ppt = new ComputerFundamentalsPPT();
ppt.generate().catch(console.error);
